// Borrado en cascada hecho a mano: no dependemos de que la base tenga activadas las foreign keys.
// Junta todos los ids que cuelgan del elemento y los borra de abajo hacia arriba en un solo lote.
import "server-only";
import { inArray, or, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db";
import {
  alumnos,
  asignaciones,
  asistencias,
  cierres,
  clases,
  cursos,
  divisiones,
  escuelas,
  eventos,
  eventosExcepciones,
  inscripciones,
  modalidades,
  notas,
  notasEvento,
  pesos,
  planFormativo,
  planificaciones,
  proyectos,
  temas,
  unidades,
} from "@/db/schema";

export type Nivel = "modalidad" | "escuela" | "curso" | "division" | "materia";

async function idsDe<T extends { id: number }>(consulta: Promise<T[]>) {
  return (await consulta).map((r) => r.id);
}

export async function borrarEnCascada(nivel: Nivel, id: number) {
  const modalidadIds = nivel === "modalidad" ? [id] : [];

  const escuelaIds =
    nivel === "escuela"
      ? [id]
      : modalidadIds.length
        ? await idsDe(db.select({ id: escuelas.id }).from(escuelas).where(inArray(escuelas.modalidadId, modalidadIds)))
        : [];

  const cursoIds =
    nivel === "curso"
      ? [id]
      : escuelaIds.length
        ? await idsDe(db.select({ id: cursos.id }).from(cursos).where(inArray(cursos.escuelaId, escuelaIds)))
        : [];

  const divisionIds =
    nivel === "division"
      ? [id]
      : cursoIds.length
        ? await idsDe(db.select({ id: divisiones.id }).from(divisiones).where(inArray(divisiones.cursoId, cursoIds)))
        : [];

  const asignacionIds =
    nivel === "materia"
      ? [id]
      : divisionIds.length
        ? await idsDe(db.select({ id: asignaciones.id }).from(asignaciones).where(inArray(asignaciones.divisionId, divisionIds)))
        : [];

  // Alumnos: solo cuando se borra la división entera (o algo de más arriba)
  const insc = divisionIds.length
    ? await db
        .select({ id: inscripciones.id, alumnoId: inscripciones.alumnoId })
        .from(inscripciones)
        .where(inArray(inscripciones.divisionId, divisionIds))
    : [];
  const inscripcionIds = insc.map((i) => i.id);
  const candidatos = [...new Set(insc.map((i) => i.alumnoId))];
  // Por las dudas, no se borra un alumno que también esté anotado en otra división
  const enOtras = candidatos.length
    ? await db
        .select({ alumnoId: inscripciones.alumnoId, divisionId: inscripciones.divisionId })
        .from(inscripciones)
        .where(inArray(inscripciones.alumnoId, candidatos))
    : [];
  const alumnoIds = candidatos.filter((a) => !enOtras.some((o) => o.alumnoId === a && !divisionIds.includes(o.divisionId)));

  const condEventos: SQL[] = [];
  if (asignacionIds.length) condEventos.push(inArray(eventos.asignacionId, asignacionIds));
  if (escuelaIds.length) condEventos.push(inArray(eventos.escuelaId, escuelaIds));
  const eventoIds = condEventos.length
    ? await idsDe(db.select({ id: eventos.id }).from(eventos).where(or(...condEventos)))
    : [];

  const claseIds = asignacionIds.length
    ? await idsDe(db.select({ id: clases.id }).from(clases).where(inArray(clases.asignacionId, asignacionIds)))
    : [];
  const notaIds = asignacionIds.length
    ? await idsDe(db.select({ id: notas.id }).from(notas).where(inArray(notas.asignacionId, asignacionIds)))
    : [];

  const lote: BatchItem<"sqlite">[] = [];
  const si = (ids: number[], q: () => BatchItem<"sqlite">) => {
    if (ids.length) lote.push(q());
  };

  si(asignacionIds, () => db.delete(proyectos).where(inArray(proyectos.asignacionId, asignacionIds)));
  si(notaIds, () => db.delete(notasEvento).where(inArray(notasEvento.notaId, notaIds)));
  si(eventoIds, () => db.delete(notasEvento).where(inArray(notasEvento.eventoId, eventoIds)));
  si(eventoIds, () => db.delete(eventosExcepciones).where(inArray(eventosExcepciones.eventoId, eventoIds)));
  si(eventoIds, () => db.delete(eventos).where(inArray(eventos.id, eventoIds)));
  si(claseIds, () => db.delete(asistencias).where(inArray(asistencias.claseId, claseIds)));
  si(inscripcionIds, () => db.delete(asistencias).where(inArray(asistencias.inscripcionId, inscripcionIds)));
  si(notaIds, () => db.delete(notas).where(inArray(notas.id, notaIds)));
  si(inscripcionIds, () => db.delete(notas).where(inArray(notas.inscripcionId, inscripcionIds)));
  si(claseIds, () => db.delete(clases).where(inArray(clases.id, claseIds)));
  si(asignacionIds, () => db.delete(temas).where(inArray(temas.asignacionId, asignacionIds)));
  si(asignacionIds, () => db.delete(pesos).where(inArray(pesos.asignacionId, asignacionIds)));
  si(asignacionIds, () => db.delete(cierres).where(inArray(cierres.asignacionId, asignacionIds)));
  si(inscripcionIds, () => db.delete(cierres).where(inArray(cierres.inscripcionId, inscripcionIds)));
  si(asignacionIds, () => db.delete(planFormativo).where(inArray(planFormativo.asignacionId, asignacionIds)));
  si(inscripcionIds, () => db.delete(planFormativo).where(inArray(planFormativo.inscripcionId, inscripcionIds)));
  si(asignacionIds, () => db.delete(unidades).where(inArray(unidades.asignacionId, asignacionIds)));
  si(asignacionIds, () => db.delete(planificaciones).where(inArray(planificaciones.asignacionId, asignacionIds)));
  si(asignacionIds, () => db.delete(asignaciones).where(inArray(asignaciones.id, asignacionIds)));
  si(inscripcionIds, () => db.delete(inscripciones).where(inArray(inscripciones.id, inscripcionIds)));
  si(alumnoIds, () => db.delete(alumnos).where(inArray(alumnos.id, alumnoIds)));
  si(divisionIds, () => db.delete(divisiones).where(inArray(divisiones.id, divisionIds)));
  si(cursoIds, () => db.delete(cursos).where(inArray(cursos.id, cursoIds)));
  si(escuelaIds, () => db.delete(escuelas).where(inArray(escuelas.id, escuelaIds)));
  si(modalidadIds, () => db.delete(modalidades).where(inArray(modalidades.id, modalidadIds)));

  if (lote.length) await db.batch(lote as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

// Un alumno cargado por error: se lo saca de la división con todo lo suyo y se corre la numeración
export async function borrarInscripcion(inscripcionId: number) {
  const [insc] = await db.select().from(inscripciones).where(inArray(inscripciones.id, [inscripcionId]));
  if (!insc) return null;
  const ids = [inscripcionId];
  const otras = await db.select({ id: inscripciones.id }).from(inscripciones).where(inArray(inscripciones.alumnoId, [insc.alumnoId]));
  const lote = [
    db.delete(asistencias).where(inArray(asistencias.inscripcionId, ids)),
    db.delete(notasEvento).where(
      inArray(notasEvento.notaId, db.select({ id: notas.id }).from(notas).where(inArray(notas.inscripcionId, ids))),
    ),
    db.delete(notas).where(inArray(notas.inscripcionId, ids)),
    db.delete(cierres).where(inArray(cierres.inscripcionId, ids)),
    db.delete(planFormativo).where(inArray(planFormativo.inscripcionId, ids)),
    db.delete(inscripciones).where(inArray(inscripciones.id, ids)),
  ] as const;
  if (otras.length > 1) await db.batch(lote);
  else await db.batch([...lote, db.delete(alumnos).where(inArray(alumnos.id, [insc.alumnoId]))]);
  return insc;
}
