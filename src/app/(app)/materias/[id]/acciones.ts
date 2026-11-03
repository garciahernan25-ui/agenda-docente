"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  asignaciones,
  CATEGORIAS,
  cierres,
  clases,
  ESTADOS_ASISTENCIA,
  notas,
  planFormativo,
  temas,
  VALORACIONES,
} from "@/db/schema";
import { exigirDocente } from "@/lib/auth";
import { aplicarAsistencia, validarInscripciones } from "@/lib/sin-conexion";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ---------------- Asistencia ---------------- */

const entradaAsistencia = z.object({
  asignacionId: z.number().int(),
  fecha,
  dictada: z.boolean(),
  temaId: z.number().int().nullable().optional(),
  registros: z.array(z.object({ inscripcionId: z.number().int(), estado: z.enum(ESTADOS_ASISTENCIA) })),
});

export async function guardarAsistencia(entrada: z.input<typeof entradaAsistencia>) {
  await exigirDocente();
  const d = entradaAsistencia.parse(entrada);
  await aplicarAsistencia(d);
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const };
}

export async function borrarClase(asignacionId: number, fechaClase: string) {
  await exigirDocente();
  fecha.parse(fechaClase);
  await db.delete(clases).where(and(eq(clases.asignacionId, asignacionId), eq(clases.fecha, fechaClase)));
  revalidatePath(`/materias/${asignacionId}`, "layout");
}

/* ---------------- Notas ---------------- */

const entradaNotas = z.object({
  asignacionId: z.number().int(),
  cuatrimestre: z.union([z.literal(1), z.literal(2)]),
  categoria: z.enum(CATEGORIAS),
  temaId: z.number().int().nullable(),
  temaNuevo: z.string().trim().max(120).optional(),
  fecha,
  valores: z.array(z.object({ inscripcionId: z.number().int(), valor: z.number().min(1).max(10) })),
});

export async function guardarNotas(entrada: z.input<typeof entradaNotas>) {
  await exigirDocente();
  const d = entradaNotas.parse(entrada);
  await validarInscripciones(d.asignacionId, d.valores.map((v) => v.inscripcionId));

  let temaId = d.temaId;
  if (d.temaNuevo) {
    const [t] = await db
      .insert(temas)
      .values({ asignacionId: d.asignacionId, cuatrimestre: d.cuatrimestre, titulo: d.temaNuevo, orden: Date.now() % 1e9 })
      .returning();
    temaId = t.id;
  }
  if (d.valores.length) {
    await db.insert(notas).values(
      d.valores.map((v) => ({
        asignacionId: d.asignacionId,
        inscripcionId: v.inscripcionId,
        cuatrimestre: d.cuatrimestre,
        categoria: d.categoria,
        temaId,
        valor: v.valor,
        fecha: d.fecha,
      })),
    );
  }
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const, cantidad: d.valores.length, temaId };
}

export async function borrarNota(asignacionId: number, notaId: number) {
  await exigirDocente();
  await db.delete(notas).where(and(eq(notas.id, notaId), eq(notas.asignacionId, asignacionId)));
  revalidatePath(`/materias/${asignacionId}`, "layout");
}

export async function cambiarNota(asignacionId: number, notaId: number, valor: number) {
  await exigirDocente();
  const v = z.number().min(1).max(10).parse(valor);
  await db.update(notas).set({ valor: v }).where(and(eq(notas.id, notaId), eq(notas.asignacionId, asignacionId)));
  revalidatePath(`/materias/${asignacionId}`, "layout");
}

/*
 * Corrige una tanda de notas (misma fecha, parte y tema): cambia valores, borra las que dejaste vacías,
 * agrega a quien te faltó y, si te confundiste, mueve toda la tanda a otra fecha, parte o tema.
 */
const entradaTanda = z.object({
  asignacionId: z.number().int(),
  cuatrimestre: z.union([z.literal(1), z.literal(2)]),
  notaIds: z.array(z.number().int()), // las notas que forman la tanda hoy
  cambios: z.array(z.object({ notaId: z.number().int(), valor: z.number().min(1).max(10).nullable() })),
  nuevas: z.array(z.object({ inscripcionId: z.number().int(), valor: z.number().min(1).max(10) })),
  fecha,
  categoria: z.enum(CATEGORIAS),
  temaId: z.number().int().nullable(),
});

export async function guardarTanda(entrada: z.input<typeof entradaTanda>) {
  await exigirDocente();
  const d = entradaTanda.parse(entrada);
  await validarInscripciones(d.asignacionId, d.nuevas.map((n) => n.inscripcionId));
  const propias = new Set(
    d.notaIds.length
      ? (await db.select({ id: notas.id }).from(notas).where(and(eq(notas.asignacionId, d.asignacionId), inArray(notas.id, d.notaIds)))).map((r) => r.id)
      : [],
  );
  if (d.cambios.some((c) => !propias.has(c.notaId))) throw new Error("Hay notas que no son de esta materia");

  const temaId = d.categoria === "examen" ? null : d.temaId;
  for (const c of d.cambios) {
    if (c.valor === null) await db.delete(notas).where(eq(notas.id, c.notaId));
    else await db.update(notas).set({ valor: c.valor }).where(eq(notas.id, c.notaId));
  }
  if (propias.size) {
    await db.update(notas).set({ fecha: d.fecha, categoria: d.categoria, temaId }).where(inArray(notas.id, [...propias]));
  }
  if (d.nuevas.length) {
    await db.insert(notas).values(
      d.nuevas.map((n) => ({
        asignacionId: d.asignacionId,
        inscripcionId: n.inscripcionId,
        cuatrimestre: d.cuatrimestre,
        categoria: d.categoria,
        temaId,
        valor: n.valor,
        fecha: d.fecha,
      })),
    );
  }
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const };
}

/* ---------------- Planilla por tema ---------------- */

export async function crearTema(asignacionId: number, cuatrimestre: 1 | 2, titulo: string) {
  await exigirDocente();
  const t = z.string().trim().min(1).max(120).parse(titulo);
  const [nuevo] = await db
    .insert(temas)
    .values({ asignacionId, cuatrimestre: z.union([z.literal(1), z.literal(2)]).parse(cuatrimestre), titulo: t, orden: Date.now() % 1e9 })
    .returning();
  revalidatePath(`/materias/${asignacionId}`, "layout");
  return nuevo.id;
}

export async function renombrarTema(asignacionId: number, temaId: number, titulo: string) {
  await exigirDocente();
  const t = z.string().trim().min(1).max(120).parse(titulo);
  await db.update(temas).set({ titulo: t }).where(and(eq(temas.id, temaId), eq(temas.asignacionId, asignacionId)));
  revalidatePath(`/materias/${asignacionId}`, "layout");
}

const entradaGrilla = z.object({
  asignacionId: z.number().int(),
  cuatrimestre: z.union([z.literal(1), z.literal(2)]),
  temaId: z.number().int(),
  fecha, // fecha para las notas nuevas
  celdas: z.array(
    z.object({
      inscripcionId: z.number().int(),
      categoria: z.enum(CATEGORIAS),
      notaId: z.number().int().nullable(), // la nota que ya estaba en ese casillero
      valor: z.number().min(1).max(10).nullable(), // null = borrar
    }),
  ),
});

// Guarda de una todos los casilleros que tocaste en la planilla del tema
export async function guardarGrillaTema(entrada: z.input<typeof entradaGrilla>) {
  await exigirDocente();
  const d = entradaGrilla.parse(entrada);
  await validarInscripciones(d.asignacionId, d.celdas.map((c) => c.inscripcionId));
  const [tema] = await db.select().from(temas).where(and(eq(temas.id, d.temaId), eq(temas.asignacionId, d.asignacionId)));
  if (!tema) throw new Error("Tema inexistente");

  const ids = d.celdas.map((c) => c.notaId).filter((x): x is number => x !== null);
  const propias = new Set(
    ids.length
      ? (await db.select({ id: notas.id }).from(notas).where(and(eq(notas.asignacionId, d.asignacionId), eq(notas.temaId, d.temaId), inArray(notas.id, ids)))).map((r) => r.id)
      : [],
  );
  if (ids.some((i) => !propias.has(i))) throw new Error("Hay notas que no son de este tema");

  const nuevas = [];
  for (const c of d.celdas) {
    if (c.notaId !== null) {
      if (c.valor === null) await db.delete(notas).where(eq(notas.id, c.notaId));
      else await db.update(notas).set({ valor: c.valor }).where(eq(notas.id, c.notaId));
    } else if (c.valor !== null) {
      nuevas.push({
        asignacionId: d.asignacionId,
        inscripcionId: c.inscripcionId,
        cuatrimestre: tema.cuatrimestre,
        categoria: c.categoria,
        temaId: d.temaId,
        valor: c.valor,
        fecha: d.fecha,
      });
    }
  }
  if (nuevas.length) await db.insert(notas).values(nuevas);
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const };
}

/* ---------------- Cierre ---------------- */

const notaCierre = z.number().int().min(1).max(10).nullable();
const entradaCierre = z.object({
  asignacionId: z.number().int(),
  filas: z.array(
    z.object({
      inscripcionId: z.number().int(),
      valoracion1: z.enum(VALORACIONES).nullable().optional(),
      calificacion1: notaCierre.optional(),
      valoracion2: z.enum(VALORACIONES).nullable().optional(),
      calificacion2: notaCierre.optional(),
      intensificacion1: notaCierre.optional(),
      diciembre: notaCierre.optional(),
      febrero: notaCierre.optional(),
      calificacionFinal: notaCierre.optional(),
    }),
  ),
});

export async function guardarCierre(entrada: z.input<typeof entradaCierre>) {
  await exigirDocente();
  const d = entradaCierre.parse(entrada);
  await validarInscripciones(d.asignacionId, d.filas.map((f) => f.inscripcionId));
  for (const { inscripcionId, ...campos } of d.filas) {
    await db
      .insert(cierres)
      .values({ asignacionId: d.asignacionId, inscripcionId, ...campos })
      .onConflictDoUpdate({
        target: [cierres.asignacionId, cierres.inscripcionId],
        set: { ...campos, actualizadoEn: new Date().toISOString() },
      });
  }
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const };
}

/* ---------------- EPS ---------------- */

const textoCorto = z.string().max(4000).optional().default("");
const entradaRite = z.object({
  asignacionId: z.number().int(),
  contextual: z.object({
    capacidades: textoCorto,
    actividades: textoCorto,
    dificultades: textoCorto,
    observaciones: textoCorto,
  }),
  filas: z.array(
    z.object({
      inscripcionId: z.number().int(),
      valoracion1: z.enum(VALORACIONES).nullable(),
      calificacion1: notaCierre,
      valoracion2: z.enum(VALORACIONES).nullable(),
      calificacion2: notaCierre,
      calificacionFinal: notaCierre,
      observacionRite: z.string().max(2000),
    }),
  ),
});

// Guarda el RITE: informe contextual de la materia y, por estudiante, informes, valoración final y observaciones
export async function guardarRite(entrada: z.input<typeof entradaRite>) {
  await exigirDocente();
  const d = entradaRite.parse(entrada);
  await validarInscripciones(d.asignacionId, d.filas.map((f) => f.inscripcionId));
  await db.update(asignaciones).set({ informeContextual: d.contextual }).where(eq(asignaciones.id, d.asignacionId));
  for (const { inscripcionId, ...campos } of d.filas) {
    const c = { ...campos, observacionRite: campos.observacionRite.trim() || null };
    await db
      .insert(cierres)
      .values({ asignacionId: d.asignacionId, inscripcionId, ...c })
      .onConflictDoUpdate({
        target: [cierres.asignacionId, cierres.inscripcionId],
        set: { ...c, actualizadoEn: new Date().toISOString() },
      });
  }
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const };
}

const entradaPlan = z.object({
  asignacionId: z.number().int(),
  inscripcionId: z.number().int(),
  niveles: z.array(
    z.object({
      nivel: z.number().int().min(1).max(4),
      evaluaciones: z.array(z.string().trim().max(40)).length(5),
    }),
  ),
});

// Guarda la fila de tu área del Plan de trabajo formativo de un estudiante (5 casilleros por nivel)
export async function guardarPlan(entrada: z.input<typeof entradaPlan>) {
  await exigirDocente();
  const d = entradaPlan.parse(entrada);
  await validarInscripciones(d.asignacionId, [d.inscripcionId]);
  for (const n of d.niveles) {
    if (n.evaluaciones.every((e) => e === "")) {
      await db
        .delete(planFormativo)
        .where(and(eq(planFormativo.asignacionId, d.asignacionId), eq(planFormativo.inscripcionId, d.inscripcionId), eq(planFormativo.nivel, n.nivel)));
      continue;
    }
    await db
      .insert(planFormativo)
      .values({ asignacionId: d.asignacionId, inscripcionId: d.inscripcionId, nivel: n.nivel, evaluaciones: n.evaluaciones })
      .onConflictDoUpdate({
        target: [planFormativo.asignacionId, planFormativo.inscripcionId, planFormativo.nivel],
        set: { evaluaciones: n.evaluaciones, actualizadoEn: new Date().toISOString() },
      });
  }
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const };
}
