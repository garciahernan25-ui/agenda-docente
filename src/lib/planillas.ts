// Arma los datos de las planillas leyendo la base. Lo usan la pantalla de la planilla y los PDF.
import { and, asc, eq, inArray } from "drizzle-orm";
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
  inscripciones,
  modalidades,
  notas,
  pesos as pesosT,
  temas,
  type EstadoAsistencia,
} from "@/db/schema";
import {
  calificacionPonderada,
  parcialesParaPlanilla,
  PESOS_POR_DEFECTO,
  resumenAsistencia,
  sugerirValoracion,
  type Pesos,
} from "./calculos";
import type { DatosPlanilla, FilaPlanilla } from "@/pdf/planilla-calificaciones";
import { calificacionImpresa, totalesDeFilas, type FilaPlanillaEditable } from "./planilla-calculos";
import type { DatosAsistencia } from "@/pdf/planilla-asistencia";

export async function cabecera(asignacionId: number) {
  const [r] = await db
    .select({
      asig: asignaciones,
      div: divisiones,
      curso: cursos,
      escuela: escuelas,
      modalidad: modalidades,
    })
    .from(asignaciones)
    .innerJoin(divisiones, eq(asignaciones.divisionId, divisiones.id))
    .innerJoin(cursos, eq(divisiones.cursoId, cursos.id))
    .innerJoin(escuelas, eq(cursos.escuelaId, escuelas.id))
    .innerJoin(modalidades, eq(escuelas.modalidadId, modalidades.id))
    .where(eq(asignaciones.id, asignacionId));
  if (!r) throw new Error("No existe esa materia");
  return r;
}

export async function listaAlumnos(divisionId: number) {
  return db
    .select({ insc: inscripciones, alumno: alumnos })
    .from(inscripciones)
    .innerJoin(alumnos, eq(inscripciones.alumnoId, alumnos.id))
    .where(eq(inscripciones.divisionId, divisionId))
    .orderBy(asc(inscripciones.orden));
}

export async function asistenciaPorAlumno(asignacionId: number, cuatrimestre: number) {
  const cls = await db
    .select()
    .from(clases)
    .where(and(eq(clases.asignacionId, asignacionId), eq(clases.cuatrimestre, cuatrimestre)))
    .orderBy(asc(clases.fecha));
  const dictadas = cls.filter((c) => c.dictada);
  const regs = dictadas.length
    ? await db.select().from(asistencias).where(inArray(asistencias.claseId, dictadas.map((c) => c.id)))
    : [];
  const mapa = new Map<string, EstadoAsistencia>();
  for (const r of regs) mapa.set(`${r.claseId}:${r.inscripcionId}`, r.estado);
  return { todas: cls, dictadas, mapa };
}

/*
 * Una fila por alumno con todo lo que va en la planilla oficial:
 * lo confirmado en el cierre, lo calculado (para proponer) y lo que sale de notas y asistencia.
 * La usan la pantalla "Planilla de notas" y el PDF.
 */
export async function filasPlanilla(asignacionId: number) {
  const cab = await cabecera(asignacionId);
  const { asig, div, curso } = cab;
  const lista = await listaAlumnos(div.id);
  const [cierresRows, notasRows, temasRows, pesosRows, as1, as2] = await Promise.all([
    db.select().from(cierres).where(eq(cierres.asignacionId, asignacionId)),
    db.select().from(notas).where(eq(notas.asignacionId, asignacionId)),
    db.select().from(temas).where(eq(temas.asignacionId, asignacionId)).orderBy(asc(temas.orden)),
    db.select().from(pesosT).where(eq(pesosT.asignacionId, asignacionId)),
    asistenciaPorAlumno(asignacionId, 1),
    asistenciaPorAlumno(asignacionId, 2),
  ]);
  const pesos: Pesos = pesosRows.length
    ? Object.fromEntries(pesosRows.map((p) => [p.categoria, p.peso]))
    : PESOS_POR_DEFECTO;

  const resAsis = (inscId: number, a: typeof as1) =>
    resumenAsistencia(
      a.dictadas
        .map((c) => a.mapa.get(`${c.id}:${inscId}`))
        .filter((e): e is EstadoAsistencia => !!e),
    );
  // Valoración preliminar: notas de los dos primeros meses de cada cuatrimestre
  const corte = { 1: `${curso.cicloLectivo}-05-01`, 2: `${curso.cicloLectivo}-10-01` } as const;

  const filas = lista.map(({ insc, alumno }): FilaPlanillaEditable => {
    const c = cierresRows.find((x) => x.inscripcionId === insc.id);
    const nn = notasRows.filter((n) => n.inscripcionId === insc.id);
    const n1 = nn.filter((n) => n.cuatrimestre === 1);
    const n2 = nn.filter((n) => n.cuatrimestre === 2);
    const r1 = resAsis(insc.id, as1);
    const r2 = resAsis(insc.id, as2);
    return {
      inscripcionId: insc.id,
      orden: insc.orden,
      apellidoNombre: `${alumno.apellido.toUpperCase()}, ${alumno.nombre}`,
      baja: insc.estado === "baja",
      cursaRecursa: insc.cursaRecursa,
      observacion: insc.observacion,
      parciales1: parcialesParaPlanilla(n1, temasRows.filter((t) => t.cuatrimestre === 1).map((t) => t.id)),
      parciales2: parcialesParaPlanilla(n2, temasRows.filter((t) => t.cuatrimestre === 2).map((t) => t.id)),
      // las de la planilla en papel (si se importaron) mandan sobre las calculadas
      inasistencias1: c?.inasistencias1Planilla ?? (r1.clases ? r1.inasistencias : null),
      inasistencias2: c?.inasistencias2Planilla ?? (r2.clases ? r2.inasistencias : null),
      // Sin registros de asistencia no se puede afirmar que no concurrió
      concurrio1: r1.clases ? r1.concurrio : null,
      concurrio2: r2.clases ? r2.concurrio : null,
      calculada1: calificacionPonderada(n1, pesos)?.entera ?? null,
      calculada2: calificacionPonderada(n2, pesos)?.entera ?? null,
      sugerida1: sugerirValoracion(n1.filter((n) => n.fecha < corte[1]), pesos),
      sugerida2: sugerirValoracion(n2.filter((n) => n.fecha < corte[2]), pesos),
      cierre: {
        valoracion1: c?.valoracion1 ?? null,
        calificacion1: c?.calificacion1 ?? null,
        valoracion2: c?.valoracion2 ?? null,
        calificacion2: c?.calificacion2 ?? null,
        intensificacion1: c?.intensificacion1 ?? null,
        diciembre: c?.diciembre ?? null,
        febrero: c?.febrero ?? null,
        calificacionFinal: c?.calificacionFinal ?? null,
      },
    };
  });

  return {
    cab,
    filas,
    clases: {
      totales1: asig.totalClases1 ?? (as1.todas.length || null),
      totales2: asig.totalClases2 ?? (as2.todas.length || null),
      dadas1: as1.dictadas.length || null,
      dadas2: as2.dictadas.length || null,
    },
  };
}

export async function datosPlanillaCalificaciones(asignacionId: number): Promise<DatosPlanilla> {
  const { cab, filas, clases } = await filasPlanilla(asignacionId);
  const { asig, div, curso, escuela } = cab;
  return {
    escuela: escuela.nombre,
    cicloLectivo: curso.cicloLectivo,
    materia: asig.materia,
    profesor: asig.profesor,
    anio: curso.anio,
    seccion: div.seccion,
    turno: div.turno,
    preceptor: div.preceptor,
    filas: filas.map(
      (f): FilaPlanilla => ({
        orden: f.orden,
        apellidoNombre: f.apellidoNombre,
        cursaRecursa: f.cursaRecursa,
        observacion: f.observacion,
        parciales1: f.parciales1,
        valoracion1: f.cierre.valoracion1,
        calificacion1: calificacionImpresa(f, f.cierre, 1),
        inasistencias1: f.inasistencias1,
        parciales2: f.parciales2,
        valoracion2: f.cierre.valoracion2,
        calificacion2: calificacionImpresa(f, f.cierre, 2),
        intensificacion1: f.cierre.intensificacion1,
        inasistencias2: f.inasistencias2,
        diciembre: f.cierre.diciembre,
        febrero: f.cierre.febrero,
        calificacionFinal: f.cierre.calificacionFinal,
      }),
    ),
    totales: totalesDeFilas(filas),
    clases,
  };
}

export async function datosPlanillaAsistencia(
  asignacionId: number,
  cuatrimestre: number,
): Promise<DatosAsistencia> {
  const { asig, div, curso, escuela } = await cabecera(asignacionId);
  const lista = await listaAlumnos(div.id);
  const a = await asistenciaPorAlumno(asignacionId, cuatrimestre);
  return {
    escuela: escuela.nombre,
    materia: asig.materia,
    profesor: asig.profesor,
    curso: `${curso.anio} ${div.seccion} – ${div.turno}`,
    periodo: `${cuatrimestre}° cuatrimestre ${curso.cicloLectivo}`,
    fechas: a.dictadas.map((c) => c.fecha),
    alumnos: lista.map(({ insc, alumno }) => ({
      orden: insc.orden,
      apellidoNombre: `${alumno.apellido.toUpperCase()}, ${alumno.nombre}`,
      baja: insc.estado === "baja",
      estados: a.dictadas.map((c) => a.mapa.get(`${c.id}:${insc.id}`) ?? null),
    })),
  };
}
