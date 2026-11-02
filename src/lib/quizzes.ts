// Conexión con quizzes-profe-nacho: trae las notas de los quizzes y arma qué cargar en cada tema.
// El quiz va al tema que se llama igual; el estudiante, al que vinculaste (o el que más se parece por nombre).
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { alumnos, inscripciones, notas, temas } from "@/db/schema";
import { cabecera } from "./planillas";
import { normal, parecido } from "./nombres";

type RespuestaQuizzes = {
  quizzes: { id: string; title: string }[];
  alumnos: { id: string; nombre: string; curso: string | null; escuela: string | null; modalidad: string | null }[];
  notas: { studentId: string; quizId: string; nota: number; editada: boolean; fecha: string | null }[];
};

export type Lectura = { ok: true; datos: RespuestaQuizzes } | { ok: false; motivo: "sin-config" | "token" | "error"; detalle?: string };

export function quizzesConfigurado() {
  return !!process.env.QUIZZES_URL?.trim() && !!process.env.QUIZZES_TOKEN?.trim();
}

export async function leerQuizzes(): Promise<Lectura> {
  const url = process.env.QUIZZES_URL?.trim().replace(/\/+$/, "");
  const token = process.env.QUIZZES_TOKEN?.trim();
  if (!url || !token) return { ok: false, motivo: "sin-config" };
  try {
    const r = await fetch(`${url}/api/agenda/notas`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (r.status === 401) return { ok: false, motivo: "token" };
    if (!r.ok) return { ok: false, motivo: "error", detalle: `La página de quizzes respondió ${r.status}` };
    const j = (await r.json()) as RespuestaQuizzes & { ok: boolean };
    if (!j.ok) return { ok: false, motivo: "error", detalle: "La página de quizzes no pudo armar las notas" };
    return { ok: true, datos: { quizzes: j.quizzes, alumnos: j.alumnos, notas: j.notas } };
  } catch {
    return { ok: false, motivo: "error", detalle: "No se pudo conectar con la página de quizzes" };
  }
}

// La escala de la planilla es de 1 a 10
const aEscala = (n: number) => Math.min(10, Math.max(1, Math.round(n * 10) / 10));

export async function planQuizzes(asignacionId: number, datos: RespuestaQuizzes) {
  const cab = await cabecera(asignacionId);
  const [temasRows, lista, existentes] = await Promise.all([
    db.select().from(temas).where(eq(temas.asignacionId, asignacionId)).orderBy(asc(temas.cuatrimestre), asc(temas.orden)),
    db
      .select({ insc: inscripciones, alumno: alumnos })
      .from(inscripciones)
      .innerJoin(alumnos, eq(inscripciones.alumnoId, alumnos.id))
      .where(eq(inscripciones.divisionId, cab.div.id))
      .orderBy(asc(inscripciones.orden)),
    db
      .select()
      .from(notas)
      .where(and(eq(notas.asignacionId, asignacionId), eq(notas.origen, "quiz"))),
  ]);

  // Tema ↔ quiz por nombre
  const quizPorNombre = new Map(datos.quizzes.map((q) => [normal(q.title), q]));
  const temasConQuiz = temasRows.map((t) => ({ tema: t, quiz: quizPorNombre.get(normal(t.titulo)) ?? null }));
  const quizIds = new Set(temasConQuiz.flatMap((x) => (x.quiz ? [x.quiz.id] : [])));

  // Estudiantes de quizzes que hicieron alguno de esos quizzes: entre ellos se busca a cada uno
  const conNotas = new Set(datos.notas.filter((n) => quizIds.has(n.quizId)).map((n) => n.studentId));
  const candidatos = datos.alumnos.filter((a) => conNotas.has(a.id));
  const nombreQuiz = new Map(datos.alumnos.map((a) => [a.id, a]));
  const vinculadosEnOtro = new Set(lista.map((l) => l.alumno.quizAlumnoId).filter(Boolean) as string[]);

  const estudiantes = lista
    .filter(({ insc, alumno }) => insc.estado === "activo" || alumno.quizAlumnoId)
    .map(({ insc, alumno }) => {
      let sugerido: string | null = null;
      if (!alumno.quizAlumnoId) {
        const puntajes = candidatos
          .filter((c) => !vinculadosEnOtro.has(c.id))
          .map((c) => ({ id: c.id, p: parecido(c.nombre, alumno.apellido, alumno.nombre) }))
          .filter((x) => x.p >= 0.6)
          .sort((a, b) => b.p - a.p);
        // solo si hay un claro ganador
        if (puntajes.length && (puntajes.length === 1 || puntajes[0].p > puntajes[1].p)) sugerido = puntajes[0].id;
      }
      return {
        inscripcionId: insc.id,
        alumnoId: alumno.id,
        apellidoNombre: `${alumno.apellido}, ${alumno.nombre}`,
        baja: insc.estado === "baja",
        quizAlumnoId: alumno.quizAlumnoId,
        nombreEnQuizzes: alumno.quizAlumnoId ? (nombreQuiz.get(alumno.quizAlumnoId)?.nombre ?? "(ya no está en quizzes)") : null,
        sugerido,
      };
    });

  // Notas a cargar o actualizar (solo de estudiantes ya vinculados)
  const notaDe = new Map(datos.notas.map((n) => [`${n.studentId}|${n.quizId}`, n]));
  const cambios: {
    inscripcionId: number;
    temaId: number;
    cuatrimestre: number;
    quizId: string;
    valor: number;
    fecha: string | null;
    existenteId: number | null;
    antes: number | null;
  }[] = [];
  for (const e of estudiantes) {
    if (!e.quizAlumnoId) continue;
    for (const { tema, quiz } of temasConQuiz) {
      if (!quiz) continue;
      const n = notaDe.get(`${e.quizAlumnoId}|${quiz.id}`);
      if (!n) continue;
      const valor = aEscala(n.nota);
      const ya = existentes.find((x) => x.inscripcionId === e.inscripcionId && x.quizRef === quiz.id);
      if (ya && ya.valor === valor && ya.temaId === tema.id) continue;
      cambios.push({
        inscripcionId: e.inscripcionId,
        temaId: tema.id,
        cuatrimestre: tema.cuatrimestre,
        quizId: quiz.id,
        valor,
        fecha: n.fecha,
        existenteId: ya?.id ?? null,
        antes: ya?.valor ?? null,
      });
    }
  }

  return {
    cab,
    temasConQuiz: temasConQuiz.map(({ tema, quiz }) => ({ temaId: tema.id, titulo: tema.titulo, cuatrimestre: tema.cuatrimestre, quiz: quiz?.title ?? null })),
    estudiantes,
    candidatos: candidatos
      .map((c) => ({ id: c.id, texto: [c.nombre, c.curso, c.escuela].filter(Boolean).join(" · ") }))
      .sort((a, b) => a.texto.localeCompare(b.texto, "es")),
    cambios,
  };
}

export async function aplicarCambios(asignacionId: number, cambios: Awaited<ReturnType<typeof planQuizzes>>["cambios"], hoy: string) {
  for (const c of cambios) {
    if (c.existenteId) {
      await db
        .update(notas)
        .set({ valor: c.valor, temaId: c.temaId, cuatrimestre: c.cuatrimestre })
        .where(and(eq(notas.id, c.existenteId), eq(notas.asignacionId, asignacionId)));
    } else {
      await db.insert(notas).values({
        asignacionId,
        inscripcionId: c.inscripcionId,
        cuatrimestre: c.cuatrimestre,
        categoria: "quiz",
        temaId: c.temaId,
        valor: c.valor,
        fecha: c.fecha ?? hoy,
        origen: "quiz",
        quizRef: c.quizId,
        comentario: "Desde quizzes",
      });
    }
  }
}

export async function vincular(asignacionId: number, pares: { inscripcionId: number; quizAlumnoId: string | null }[]) {
  if (!pares.length) return;
  const cab = await cabecera(asignacionId);
  const filas = await db
    .select({ id: inscripciones.id, alumnoId: inscripciones.alumnoId })
    .from(inscripciones)
    .where(and(eq(inscripciones.divisionId, cab.div.id), inArray(inscripciones.id, pares.map((p) => p.inscripcionId))));
  for (const p of pares) {
    const f = filas.find((x) => x.id === p.inscripcionId);
    if (f) await db.update(alumnos).set({ quizAlumnoId: p.quizAlumnoId }).where(eq(alumnos.id, f.alumnoId));
  }
}
