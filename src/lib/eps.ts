// Datos de las planillas de la EPS: RITE por área y Plan de trabajo formativo por estudiante
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cierres, notas, planFormativo, temas } from "@/db/schema";
import { parcialesParaPlanilla } from "./calculos";
import { filasPlanilla, listaAlumnos } from "./planillas";
import { rangoNiveles } from "./grupo";

export async function datosRite(asignacionId: number) {
  const { cab, filas } = await filasPlanilla(asignacionId);
  const lista = await listaAlumnos(cab.div.id);
  // "IV", "I-IV"… con los niveles de los estudiantes activos (si nadie tiene nivel, lo que diga el curso)
  const nivel = rangoNiveles(lista.filter(({ insc }) => insc.estado === "activo").map(({ insc }) => insc.nivel)) ?? (cab.curso.anio === "EPS" ? "" : cab.curso.anio);
  const obs = await db
    .select({ inscripcionId: cierres.inscripcionId, observacionRite: cierres.observacionRite })
    .from(cierres)
    .where(eq(cierres.asignacionId, asignacionId));
  return {
    cab,
    nivel,
    filas: filas
      .filter((f) => !f.baja)
      .map((f) => ({
        inscripcionId: f.inscripcionId,
        apellidoNombre: f.apellidoNombre,
        calculada1: f.calculada1,
        calculada2: f.calculada2,
        sugerida1: f.sugerida1,
        sugerida2: f.sugerida2,
        valoracion1: f.cierre.valoracion1,
        calificacion1: f.cierre.calificacion1,
        valoracion2: f.cierre.valoracion2,
        calificacion2: f.cierre.calificacion2,
        calificacionFinal: f.cierre.calificacionFinal,
        observacionRite: obs.find((o) => o.inscripcionId === f.inscripcionId)?.observacionRite ?? "",
      })),
  };
}

export type FilaRite = Awaited<ReturnType<typeof datosRite>>["filas"][number];

export async function datosPlanFormativo(asignacionId: number) {
  const { cab } = await filasPlanilla(asignacionId);
  const [lista, planes, notasRows, temasRows] = await Promise.all([
    listaAlumnos(cab.div.id),
    db.select().from(planFormativo).where(eq(planFormativo.asignacionId, asignacionId)),
    db.select().from(notas).where(eq(notas.asignacionId, asignacionId)),
    db.select().from(temas).where(eq(temas.asignacionId, asignacionId)).orderBy(asc(temas.cuatrimestre), asc(temas.orden)),
  ]);
  const ordenTemas = temasRows.map((t) => t.id);
  return {
    cab,
    estudiantes: lista
      .filter(({ insc }) => insc.estado === "activo")
      .map(({ insc, alumno }) => {
        const propias = notasRows.filter((n) => n.inscripcionId === insc.id);
        return {
          inscripcionId: insc.id,
          apellidoNombre: `${alumno.apellido.toUpperCase()}, ${alumno.nombre}`,
          nivel: insc.nivel,
          inicioEps: insc.inicioEps ?? "",
          // Lo que propone la app para el nivel actual: un casillero por tema (promedio) y el examen
          propuesta: parcialesParaPlanilla(propias, ordenTemas, 5).map(String),
          niveles: Object.fromEntries(
            planes.filter((p) => p.inscripcionId === insc.id).map((p) => [p.nivel, p.evaluaciones]),
          ) as Record<number, string[]>,
        };
      }),
  };
}

export type EstudiantePlan = Awaited<ReturnType<typeof datosPlanFormativo>>["estudiantes"][number];
