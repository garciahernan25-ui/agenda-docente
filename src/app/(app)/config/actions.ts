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

export async function crearMateria(form: FormData) {
  await exigirDocente();
  const d = datos(form, { divisionId: entero, materia: texto, profesor: texto });
  const [a] = await db.insert(asignaciones).values(d).returning();
  await db.insert(pesos).values(
    Object.entries(PESOS_POR_DEFECTO).map(([categoria, peso]) => ({
      asignacionId: a.id,
      categoria: categoria as (typeof CATEGORIAS)[number],
      peso: peso!,
    })),
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
  for (const cat of CATEGORIAS) {
    const v = z.coerce.number().min(0).max(100).catch(0).parse(form.get(`peso_${cat}`) ?? 0);
    await db
      .insert(pesos)
      .values({ asignacionId: id, categoria: cat, peso: v })
      .onConflictDoUpdate({ target: [pesos.asignacionId, pesos.categoria], set: { peso: v } });
  }
  listo();
}

export async function guardarDivision(form: FormData) {
  await exigirDocente();
  const d = datos(form, { id: entero, seccion: texto, turno: z.enum(TURNOS), preceptor: opcional });
  await db.update(divisiones).set(d).where(eq(divisiones.id, d.id));
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
  await borrarEnCascada(d.nivel, d.id);
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
