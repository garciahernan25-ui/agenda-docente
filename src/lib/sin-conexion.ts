// Lo que se cargó sin internet (asistencia y notas por tema) y llega después, cuando vuelve la señal.
// Todo es "dejar como quedó": si el mismo cambio llega dos veces, el resultado es el mismo.
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  alumnos,
  asignaciones,
  asistencias,
  CATEGORIAS,
  clases,
  cursos,
  divisiones,
  escuelas,
  ESTADOS_ASISTENCIA,
  inscripciones,
  modalidades,
  notas,
  temas,
} from "@/db/schema";
import { cuatrimestreDe } from "./fechas";
import { nombreGrupo } from "./grupo";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const itemAsistencia = z.object({
  uid: z.string().min(1).max(80),
  tipo: z.literal("asistencia"),
  asignacionId: z.number().int().positive(),
  fecha,
  dictada: z.boolean(),
  temaId: z.number().int().nullable().optional(),
  registros: z.array(z.object({ inscripcionId: z.number().int(), estado: z.enum(ESTADOS_ASISTENCIA) })).max(200),
});

export const itemCeldas = z.object({
  uid: z.string().min(1).max(80),
  tipo: z.literal("celdas"),
  asignacionId: z.number().int().positive(),
  temaId: z.number().int().positive(),
  fecha,
  celdas: z
    .array(
      z.object({
        inscripcionId: z.number().int(),
        categoria: z.enum(CATEGORIAS),
        valor: z.number().min(1).max(10).nullable(), // null = borrar
      }),
    )
    .max(2000),
});

export const itemPendiente = z.discriminatedUnion("tipo", [itemAsistencia, itemCeldas]);
export type ItemPendiente = z.infer<typeof itemPendiente>;

// Que los alumnos pertenezcan a la división de esa materia
export async function validarInscripciones(asignacionId: number, ids: number[]) {
  if (!ids.length) return;
  const [a] = await db.select().from(asignaciones).where(eq(asignaciones.id, asignacionId));
  if (!a) throw new Error("Materia inexistente");
  const validas = new Set(
    (await db.select({ id: inscripciones.id }).from(inscripciones).where(eq(inscripciones.divisionId, a.divisionId))).map((r) => r.id),
  );
  if (ids.some((i) => !validas.has(i))) throw new Error("Hay alumnos que no son de este curso");
}

// Asistencia de un día: la clase se crea o se actualiza y sus registros se reemplazan
export async function aplicarAsistencia(d: Omit<z.infer<typeof itemAsistencia>, "uid" | "tipo">) {
  await validarInscripciones(d.asignacionId, d.registros.map((r) => r.inscripcionId));
  const [clase] = await db
    .insert(clases)
    .values({
      asignacionId: d.asignacionId,
      fecha: d.fecha,
      cuatrimestre: cuatrimestreDe(d.fecha),
      dictada: d.dictada,
      temaId: d.temaId ?? null,
    })
    .onConflictDoUpdate({ target: [clases.asignacionId, clases.fecha], set: { dictada: d.dictada, temaId: d.temaId ?? null } })
    .returning();
  await db.delete(asistencias).where(eq(asistencias.claseId, clase.id));
  if (d.dictada && d.registros.length) {
    await db.insert(asistencias).values(d.registros.map((r) => ({ ...r, claseId: clase.id })));
  }
}

// Casilleros de la grilla de un tema: cada uno queda con el valor que se cargó (o vacío).
// Si en un casillero hay más de una nota (dos TP del mismo tema), no se toca y se avisa.
export async function aplicarCeldas(d: Omit<z.infer<typeof itemCeldas>, "uid" | "tipo">) {
  await validarInscripciones(d.asignacionId, d.celdas.map((c) => c.inscripcionId));
  const [tema] = await db.select().from(temas).where(and(eq(temas.id, d.temaId), eq(temas.asignacionId, d.asignacionId)));
  if (!tema) throw new Error("Ese tema ya no existe");
  const existentes = await db
    .select({ id: notas.id, inscripcionId: notas.inscripcionId, categoria: notas.categoria })
    .from(notas)
    .where(and(eq(notas.asignacionId, d.asignacionId), eq(notas.temaId, d.temaId)));
  let salteadas = 0;
  for (const c of d.celdas) {
    const ya = existentes.filter((n) => n.inscripcionId === c.inscripcionId && n.categoria === c.categoria);
    if (ya.length > 1) {
      salteadas++;
      continue;
    }
    if (ya.length === 1) {
      if (c.valor === null) await db.delete(notas).where(eq(notas.id, ya[0].id));
      else await db.update(notas).set({ valor: c.valor }).where(eq(notas.id, ya[0].id));
    } else if (c.valor !== null) {
      await db.insert(notas).values({
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
  return { salteadas };
}

// Lo que el celu guarda para poder dar clase sin señal: materias, estudiantes activos, temas y notas por tema
export async function datosParaSinConexion() {
  const [asigs, lista, temasRows, notasRows] = await Promise.all([
    db
      .select({
        id: asignaciones.id,
        materia: asignaciones.materia,
        divisionId: divisiones.id,
        seccion: divisiones.seccion,
        turno: divisiones.turno,
        anio: cursos.anio,
        ciclo: cursos.cicloLectivo,
        escuela: escuelas.nombre,
        formato: modalidades.formato,
      })
      .from(asignaciones)
      .innerJoin(divisiones, eq(asignaciones.divisionId, divisiones.id))
      .innerJoin(cursos, eq(divisiones.cursoId, cursos.id))
      .innerJoin(escuelas, eq(cursos.escuelaId, escuelas.id))
      .innerJoin(modalidades, eq(escuelas.modalidadId, modalidades.id))
      .orderBy(asc(escuelas.nombre), asc(cursos.anio), asc(divisiones.seccion), asc(asignaciones.materia)),
    db
      .select({ id: inscripciones.id, divisionId: inscripciones.divisionId, orden: inscripciones.orden, estado: inscripciones.estado, nivel: inscripciones.nivel, apellido: alumnos.apellido, nombre: alumnos.nombre })
      .from(inscripciones)
      .innerJoin(alumnos, eq(inscripciones.alumnoId, alumnos.id))
      .orderBy(asc(inscripciones.orden)),
    db.select({ id: temas.id, asignacionId: temas.asignacionId, titulo: temas.titulo, cuatrimestre: temas.cuatrimestre, orden: temas.orden }).from(temas).orderBy(asc(temas.cuatrimestre), asc(temas.orden)),
    db.select({ asignacionId: notas.asignacionId, inscripcionId: notas.inscripcionId, temaId: notas.temaId, categoria: notas.categoria, valor: notas.valor }).from(notas),
  ]);
  return {
    version: 1,
    materias: asigs.map((a) => ({
      id: a.id,
      materia: a.materia,
      grupo: nombreGrupo(a.formato, a.anio, a.seccion),
      turno: a.turno,
      escuela: a.escuela,
      ciclo: a.ciclo,
      eps: a.formato === "eps",
      alumnos: lista
        .filter((i) => i.divisionId === a.divisionId && i.estado === "activo")
        .map((i) => ({ id: i.id, orden: i.orden, nombre: `${i.apellido}, ${i.nombre}`, nivel: i.nivel })),
      temas: temasRows.filter((t) => t.asignacionId === a.id).map((t) => ({ id: t.id, titulo: t.titulo, cuatrimestre: t.cuatrimestre })),
      notas: notasRows
        .filter((n) => n.asignacionId === a.id && n.temaId !== null)
        .map((n) => ({ i: n.inscripcionId, t: n.temaId as number, c: n.categoria, v: n.valor })),
    })),
  };
}
