"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, max } from "drizzle-orm";
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
  });
  await db.update(inscripciones).set(d).where(eq(inscripciones.id, d.id));
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
