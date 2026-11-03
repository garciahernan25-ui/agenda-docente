import "server-only";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  asignaciones,
  cierres,
  cursos,
  divisiones,
  escuelas,
  eventos,
  eventosExcepciones,
  modalidades,
  notas,
  pesos as pesosT,
  temas,
  type EstadoAsistencia,
} from "@/db/schema";
import { calificacionPonderada, PESOS_POR_DEFECTO, resumenAsistencia, type Pesos } from "./calculos";
import { ocurrencias } from "./calendario";
import { asistenciaPorAlumno, cabecera, listaAlumnos } from "./planillas";

export { cabecera, listaAlumnos };

export async function listarMaterias() {
  return db
    .select({
      id: asignaciones.id,
      materia: asignaciones.materia,
      escuelaId: escuelas.id,
      escuela: escuelas.nombre,
      modalidad: modalidades.nombre,
      formato: modalidades.formato,
      anio: cursos.anio,
      ciclo: cursos.cicloLectivo,
      divisionId: divisiones.id,
      seccion: divisiones.seccion,
      turno: divisiones.turno,
    })
    .from(asignaciones)
    .innerJoin(divisiones, eq(asignaciones.divisionId, divisiones.id))
    .innerJoin(cursos, eq(divisiones.cursoId, cursos.id))
    .innerJoin(escuelas, eq(cursos.escuelaId, escuelas.id))
    .innerJoin(modalidades, eq(escuelas.modalidadId, modalidades.id))
    .orderBy(asc(escuelas.nombre), asc(cursos.anio), asc(divisiones.seccion), asc(asignaciones.materia));
}

export async function pesosDe(asignacionId: number): Promise<Pesos> {
  const filas = await db.select().from(pesosT).where(eq(pesosT.asignacionId, asignacionId));
  return filas.length ? Object.fromEntries(filas.map((p) => [p.categoria, p.peso])) : PESOS_POR_DEFECTO;
}

export async function temasDe(asignacionId: number) {
  return db.select().from(temas).where(eq(temas.asignacionId, asignacionId)).orderBy(asc(temas.cuatrimestre), asc(temas.orden), asc(temas.id));
}

// Una fila por alumno con asistencia, calificación calculada y lo confirmado en el cierre
export async function resumenMateria(asignacionId: number, cuatrimestre: 1 | 2) {
  const cab = await cabecera(asignacionId);
  const [lista, asis, notasRows, cierresRows, pesos] = await Promise.all([
    listaAlumnos(cab.div.id),
    asistenciaPorAlumno(asignacionId, cuatrimestre),
    db.select().from(notas).where(and(eq(notas.asignacionId, asignacionId), eq(notas.cuatrimestre, cuatrimestre))),
    db.select().from(cierres).where(eq(cierres.asignacionId, asignacionId)),
    pesosDe(asignacionId),
  ]);
  const filas = lista.map(({ insc, alumno }) => {
    const estados = asis.dictadas
      .map((c) => asis.mapa.get(`${c.id}:${insc.id}`))
      .filter((e): e is EstadoAsistencia => !!e);
    const n = notasRows.filter((x) => x.inscripcionId === insc.id);
    const c = cierresRows.find((x) => x.inscripcionId === insc.id);
    return {
      inscripcionId: insc.id,
      orden: insc.orden,
      nombre: `${alumno.apellido}, ${alumno.nombre}`,
      baja: insc.estado === "baja",
      cursaRecursa: insc.cursaRecursa,
      asistencia: resumenAsistencia(estados),
      cantidadNotas: n.length,
      calculada: calificacionPonderada(n, pesos),
      cierre: c ?? null,
    };
  });
  return { cab, filas, clasesDictadas: asis.dictadas.length, pesos };
}

export async function eventosEnRango(desde: string, hasta: string) {
  const evs = await db.select().from(eventos).where(lte(eventos.fechaInicio, hasta));
  const exc = evs.length
    ? await db.select().from(eventosExcepciones).where(inArray(eventosExcepciones.eventoId, evs.map((e) => e.id)))
    : [];
  const ocs = ocurrencias(evs, desde, hasta, exc);
  const porId = new Map(evs.map((e) => [e.id, e]));
  return ocs.map((o) => ({ ...o, evento: porId.get(o.eventoId)! }));
}

export async function arbolCursos() {
  const [mods, escs, curs, divs, asigs] = await Promise.all([
    db.select().from(modalidades).orderBy(asc(modalidades.nombre)),
    db.select().from(escuelas).orderBy(asc(escuelas.nombre)),
    db.select().from(cursos).orderBy(asc(cursos.anio)),
    db.select().from(divisiones).orderBy(asc(divisiones.seccion)),
    db.select().from(asignaciones).orderBy(asc(asignaciones.materia)),
  ]);
  return mods.map((m) => ({
    ...m,
    escuelas: escs
      .filter((e) => e.modalidadId === m.id)
      .map((e) => ({
        ...e,
        cursos: curs
          .filter((c) => c.escuelaId === e.id)
          .map((c) => ({
            ...c,
            divisiones: divs
              .filter((d) => d.cursoId === c.id)
              .map((d) => ({ ...d, materias: asigs.filter((a) => a.divisionId === d.id) })),
          })),
      })),
  }));
}

