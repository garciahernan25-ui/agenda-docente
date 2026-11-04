"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, gt, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  alumnos,
  asignaciones,
  CATEGORIAS,
  CATEGORIAS_FIJAS,
  CLAVE_CATEGORIA,
  notas,
  cursos,
  divisiones,
  escuelas,
  FORMATOS,
  inscripciones,
  modalidades,
  pesos,
  TURNOS,
} from "@/db/schema";
import { exigirDocente } from "@/lib/auth";
import { PESOS_POR_DEFECTO } from "@/lib/calculos";
import { armarTipos } from "@/lib/tipos-comun";
import { borrarEnCascada, borrarInscripcion } from "@/lib/borrar";

const texto = z.string().trim().min(1, "Completá este campo");
const opcional = z.string().trim().optional().transform((v) => v || null);
const entero = z.coerce.number().int().positive();

function datos<T extends z.ZodRawShape>(form: FormData, forma: T) {
  return z.object(forma).parse(Object.fromEntries(form));
}

function listo() {
  revalidatePath("/", "layout");
}

export async function crearModalidad(form: FormData) {
  await exigirDocente();
  const d = datos(form, { nombre: texto, formato: z.enum(FORMATOS).default("secundaria") });
  await db.insert(modalidades).values(d).onConflictDoNothing();
  listo();
}

export async function cambiarFormato(form: FormData) {
  await exigirDocente();
  const d = datos(form, { id: entero, formato: z.enum(FORMATOS) });
  await db.update(modalidades).set({ formato: d.formato }).where(eq(modalidades.id, d.id));
  listo();
}

export async function crearEscuela(form: FormData) {
  await exigirDocente();
  const d = datos(form, { modalidadId: entero, nombre: texto, distrito: opcional });
  await db.insert(escuelas).values(d);
  listo();
}

export async function crearCurso(form: FormData) {
  await exigirDocente();
  const d = datos(form, { escuelaId: entero, anio: texto, cicloLectivo: z.coerce.number().int().min(2020).max(2100) });
  await db.insert(cursos).values(d);
  listo();
}

export async function crearDivision(form: FormData) {
  await exigirDocente();
  const d = datos(form, { cursoId: entero, seccion: texto, turno: z.enum(TURNOS), preceptor: opcional });
  const [div] = await db.insert(divisiones).values(d).returning();
  listo();
  redirect(`/config/division/${div.id}`);
}

// Un grupo nuevo en una escuela: en secundaria año + división ("5°" + "A"); en la EPS, una comisión.
// Por dentro usa un "curso" por año y ciclo lectivo, que se busca o se crea solo.
export async function crearGrupo(form: FormData) {
  await exigirDocente();
  const d = datos(form, {
    escuelaId: entero,
    anio: z.string().trim().optional(),
    cicloLectivo: z.coerce.number().int().min(2020).max(2100),
    seccion: texto,
    turno: z.enum(TURNOS),
    preceptor: opcional,
  });
  const cursoId = await cursoPara(d.escuelaId, d.anio || "EPS", d.cicloLectivo);
  const [div] = await db.insert(divisiones).values({ cursoId, seccion: d.seccion, turno: d.turno, preceptor: d.preceptor }).returning();
  listo();
  redirect(`/config/division/${div.id}`);
}

async function cursoPara(escuelaId: number, anio: string, cicloLectivo: number) {
  const [existente] = await db
    .select({ id: cursos.id })
    .from(cursos)
    .where(and(eq(cursos.escuelaId, escuelaId), eq(cursos.anio, anio), eq(cursos.cicloLectivo, cicloLectivo)))
    .orderBy(asc(cursos.id))
    .limit(1);
  return existente?.id ?? (await db.insert(cursos).values({ escuelaId, anio, cicloLectivo }).returning())[0].id;
}

// Si un curso quedó sin divisiones, se borra (no tiene nada adentro)
async function borrarCursoVacio(cursoId: number) {
  const [hay] = await db.select({ id: divisiones.id }).from(divisiones).where(eq(divisiones.cursoId, cursoId)).limit(1);
  if (!hay) await db.delete(cursos).where(eq(cursos.id, cursoId));
}

export async function crearMateria(form: FormData) {
  await exigirDocente();
  const d = datos(form, { divisionId: entero, materia: texto, profesor: texto });
  const [a] = await db.insert(asignaciones).values(d).returning();
  await db.insert(pesos).values(
    CATEGORIAS.map((categoria, i) => ({ asignacionId: a.id, categoria, peso: PESOS_POR_DEFECTO[categoria] ?? 0, orden: i + 1 })),
  );
  listo();
}

/*
 * Pegar la lista de alumnos, uno por renglón. Acepta "APELLIDO, Nombre" o "APELLIDO Nombre"
 * (en ese caso toma la primera palabra como apellido). Se agregan al final de la lista.
 */
export async function agregarAlumnos(form: FormData) {
  await exigirDocente();
  const { divisionId, lista } = datos(form, { divisionId: entero, lista: texto });
  const renglones = lista
    .split(/\r?\n/)
    .map((r) => r.replace(/^\s*\d+[.)-]?\s*/, "").trim()) // saca numeración "1. " "2) "
    .filter(Boolean);
  const [{ ultimo }] = await db
    .select({ ultimo: max(inscripciones.orden) })
    .from(inscripciones)
    .where(eq(inscripciones.divisionId, divisionId));
  let orden = ultimo ?? 0;
  for (const r of renglones) {
    const [apellido, nombre] = separarNombre(r);
    const [al] = await db.insert(alumnos).values({ apellido, nombre }).returning();
    await db.insert(inscripciones).values({ divisionId, alumnoId: al.id, orden: ++orden });
  }
  listo();
}

function separarNombre(r: string): [string, string] {
  const titulo = (s: string) =>
    s
      .toLowerCase()
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  if (r.includes(",")) {
    const [a, ...n] = r.split(",");
    return [a.trim().toUpperCase(), titulo(n.join(",").trim())];
  }
  const [a, ...n] = r.split(/\s+/);
  return [a.toUpperCase(), titulo(n.join(" "))];
}

export async function actualizarInscripcion(form: FormData) {
  await exigirDocente();
  const d = datos(form, {
    id: entero,
    cursaRecursa: z.enum(["C", "R"]),
    estado: z.enum(["activo", "baja"]),
    observacion: opcional,
    nivel: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(1).max(4).nullable()),
    inicioEps: opcional,
    apellido: z.string().trim().optional(),
    nombre: z.string().trim().optional(),
  });
  const { apellido, nombre, ...insc } = d;
  await db.update(inscripciones).set(insc).where(eq(inscripciones.id, d.id));
  if (apellido) {
    const [fila] = await db.select({ alumnoId: inscripciones.alumnoId }).from(inscripciones).where(eq(inscripciones.id, d.id));
    if (fila) await db.update(alumnos).set({ apellido: apellido.toUpperCase(), nombre: nombre ?? "" }).where(eq(alumnos.id, fila.alumnoId));
  }
  listo();
}

// EPS: el mismo nivel para todos los estudiantes activos de la comisión
export async function asignarNivelATodos(form: FormData) {
  await exigirDocente();
  const d = datos(form, { divisionId: entero, nivel: z.coerce.number().int().min(1).max(4) });
  await db
    .update(inscripciones)
    .set({ nivel: d.nivel })
    .where(and(eq(inscripciones.divisionId, d.divisionId), eq(inscripciones.estado, "activo")));
  listo();
}

export async function guardarMateria(form: FormData) {
  await exigirDocente();
  const id = entero.parse(form.get("id"));
  const d = datos(form, {
    materia: texto,
    profesor: texto,
    totalClases1: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
    totalClases2: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  });
  await db
    .update(asignaciones)
    .set({ ...d, totalClases1: d.totalClases1 ?? null, totalClases2: d.totalClases2 ?? null })
    .where(eq(asignaciones.id, id));
  // Encabezado EPS (si la materia es de una EPS vienen estos campos)
  if (form.has("eps_area")) {
    const t = (k: string) => String(form.get(k) ?? "").trim() || undefined;
    await db
      .update(asignaciones)
      .set({
        datosEps: {
          region: t("eps_region"),
          familiaProfesional: t("eps_familia"),
          area: t("eps_area"),
          correo: t("eps_correo"),
          oferta: t("eps_oferta"),
          sede: t("eps_sede"),
          cfp: t("eps_cfp"),
        },
      })
      .where(eq(asignaciones.id, id));
  }
  listo();
}

/* ---------------- Tipos de evaluación de una materia ---------------- */

const entradaTipos = z.object({
  asignacionId: z.number().int().positive(),
  tipos: z
    .array(
      z.object({
        clave: z.string().regex(CLAVE_CATEGORIA).nullable(), // null = nuevo
        nombre: z.string().trim().min(1, "Poné un nombre").max(40),
        peso: z.number().min(0).max(100),
        oculta: z.boolean(),
      }),
    )
    .max(30),
});

function claveNueva(nombre: string, usadas: Set<string>) {
  const base =
    "x_" +
    (nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "tipo");
  let clave = base;
  for (let i = 2; usadas.has(clave); i++) clave = `${base}_${i}`;
  usadas.add(clave);
  return clave;
}

// Guarda la lista entera, en el orden en que viene. Quiz y examen no se pueden sacar.
// Lo que se saca: si tiene notas (o es de los de base) queda "sacado" y sus notas siguen contando; si no, se borra.
export async function guardarTipos(datosTipos: z.input<typeof entradaTipos>) {
  await exigirDocente();
  const d = entradaTipos.parse(datosTipos);
  const [asig] = await db.select({ id: asignaciones.id }).from(asignaciones).where(eq(asignaciones.id, d.asignacionId));
  if (!asig) throw new Error("No existe esa materia");
  const existentes = await db.select().from(pesos).where(eq(pesos.asignacionId, d.asignacionId));
  const conNotas = new Set(
    (await db.selectDistinct({ c: notas.categoria }).from(notas).where(eq(notas.asignacionId, d.asignacionId))).map((r) => r.c),
  );
  const usadas = new Set([...existentes.map((e) => e.categoria), ...CATEGORIAS]);
  const base = new Set<string>(CATEGORIAS);

  const filas = d.tipos.map((t, i) => {
    const clave = t.clave ?? claveNueva(t.nombre, usadas);
    const fija = (CATEGORIAS_FIJAS as readonly string[]).includes(clave);
    return { asignacionId: d.asignacionId, categoria: clave, nombre: t.nombre, peso: t.peso, orden: i + 1, oculta: fija ? false : t.oculta };
  });
  // Quiz y examen tienen que estar siempre
  for (const f of CATEGORIAS_FIJAS) {
    if (!filas.some((x) => x.categoria === f)) throw new Error("Quiz y Examen no se pueden sacar");
  }
  const enLista = new Set(filas.map((f) => f.categoria));
  const faltan = [...new Set([...existentes.map((e) => e.categoria), ...CATEGORIAS])].filter((c) => !enLista.has(c));

  for (const f of filas) {
    await db
      .insert(pesos)
      .values(f)
      .onConflictDoUpdate({ target: [pesos.asignacionId, pesos.categoria], set: { nombre: f.nombre, peso: f.peso, orden: f.orden, oculta: f.oculta } });
  }
  for (const c of faltan) {
    if (conNotas.has(c) || base.has(c)) {
      const ya = existentes.find((e) => e.categoria === c);
      await db
        .insert(pesos)
        .values({ asignacionId: d.asignacionId, categoria: c, peso: ya?.peso ?? PESOS_POR_DEFECTO[c] ?? 0, nombre: ya?.nombre ?? null, orden: 900, oculta: true })
        .onConflictDoUpdate({ target: [pesos.asignacionId, pesos.categoria], set: { oculta: true, orden: 900 } });
    } else {
      await db.delete(pesos).where(and(eq(pesos.asignacionId, d.asignacionId), eq(pesos.categoria, c)));
    }
  }
  listo();
  return { ok: true as const };
}

// Trae los tipos de otra materia (nombres, pesos y orden). Los propios que tengan notas no se pierden: quedan sacados.
export async function copiarTipos(desde: number, hacia: number) {
  await exigirDocente();
  const origen = await db.select().from(pesos).where(eq(pesos.asignacionId, desde));
  const lista = armarTipos(origen);
  return guardarTipos({
    asignacionId: hacia,
    tipos: lista.map((t) => ({ clave: t.clave, nombre: t.nombre, peso: t.peso, oculta: t.oculta })),
  });
}

export async function guardarDivision(form: FormData) {
  await exigirDocente();
  const d = datos(form, { id: entero, seccion: texto, turno: z.enum(TURNOS), preceptor: opcional, anio: z.string().trim().optional() });
  const { anio, ...resto } = d;
  await db.update(divisiones).set(resto).where(eq(divisiones.id, d.id));
  // Cambió el año (ej. lo cargaste en 4° y era 5°): pasa al curso de ese año
  if (anio) {
    const [actual] = await db
      .select({ cursoId: cursos.id, anio: cursos.anio, escuelaId: cursos.escuelaId, ciclo: cursos.cicloLectivo })
      .from(divisiones)
      .innerJoin(cursos, eq(divisiones.cursoId, cursos.id))
      .where(eq(divisiones.id, d.id));
    if (actual && actual.anio !== anio) {
      const nuevo = await cursoPara(actual.escuelaId, anio, actual.ciclo);
      await db.update(divisiones).set({ cursoId: nuevo }).where(eq(divisiones.id, d.id));
      await borrarCursoVacio(actual.cursoId);
    }
  }
  listo();
}

// ---- Editar lo que está arriba de la división ----

export async function editarModalidad(form: FormData) {
  await exigirDocente();
  const d = datos(form, { id: entero, nombre: texto, formato: z.enum(FORMATOS) });
  try {
    await db.update(modalidades).set({ nombre: d.nombre, formato: d.formato }).where(eq(modalidades.id, d.id));
  } catch {
    // nombre repetido: queda como estaba
  }
  listo();
}

export async function editarEscuela(form: FormData) {
  await exigirDocente();
  const d = datos(form, { id: entero, nombre: texto, distrito: opcional, modalidadId: entero });
  await db.update(escuelas).set({ nombre: d.nombre, distrito: d.distrito, modalidadId: d.modalidadId }).where(eq(escuelas.id, d.id));
  listo();
}

export async function editarCurso(form: FormData) {
  await exigirDocente();
  const d = datos(form, { id: entero, anio: texto, cicloLectivo: z.coerce.number().int().min(2020).max(2100) });
  await db.update(cursos).set({ anio: d.anio, cicloLectivo: d.cicloLectivo }).where(eq(cursos.id, d.id));
  listo();
}

// ---- Borrar (con todo lo que tiene adentro) ----

const NIVELES = ["modalidad", "escuela", "curso", "division", "materia"] as const;

export async function borrarElemento(form: FormData) {
  await exigirDocente();
  const d = datos(form, { nivel: z.enum(NIVELES), id: entero, volver: z.string().startsWith("/").optional() });
  const [div] = d.nivel === "division" ? await db.select({ cursoId: divisiones.cursoId }).from(divisiones).where(eq(divisiones.id, d.id)) : [];
  await borrarEnCascada(d.nivel, d.id);
  if (div) await borrarCursoVacio(div.cursoId);
  listo();
  if (d.volver) redirect(d.volver);
}

export async function borrarAlumno(form: FormData) {
  await exigirDocente();
  const { id } = datos(form, { id: entero });
  const insc = await borrarInscripcion(id);
  if (insc) {
    // Corre un lugar hacia arriba a los que estaban después, para que no quede un hueco en la planilla
    const siguientes = await db
      .select({ id: inscripciones.id, orden: inscripciones.orden })
      .from(inscripciones)
      .where(and(eq(inscripciones.divisionId, insc.divisionId), gt(inscripciones.orden, insc.orden)))
      .orderBy(asc(inscripciones.orden));
    for (const s of siguientes) {
      await db.update(inscripciones).set({ orden: s.orden - 1 }).where(eq(inscripciones.id, s.id));
    }
  }
  listo();
}
