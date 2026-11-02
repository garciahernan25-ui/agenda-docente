// Cálculos puros (sin base de datos), así se pueden testear y usar offline en el celular.
import type { Categoria, EstadoAsistencia, Valoracion } from "@/db/schema";

/* ---------------- Asistencia ---------------- */

// Tarde = media falta. Justificada queda registrada pero no suma inasistencia.
export const PESO_FALTA: Record<EstadoAsistencia, number> = {
  P: 0,
  A: 1,
  T: 0.5,
  J: 0,
};

export type ResumenAsistencia = {
  clases: number; // clases dictadas con registro para el alumno
  presentes: number;
  ausentes: number;
  tardes: number;
  justificadas: number;
  inasistencias: number; // A + T/2
  porcentaje: number | null; // % de asistencia, null si no hubo clases
  concurrio: boolean; // fue al menos a una clase (P o T)
};

export function resumenAsistencia(
  estados: EstadoAsistencia[],
): ResumenAsistencia {
  const c = { P: 0, A: 0, T: 0, J: 0 };
  for (const e of estados) c[e]++;
  const clases = estados.length;
  const inasistencias = estados.reduce((s, e) => s + PESO_FALTA[e], 0);
  return {
    clases,
    presentes: c.P,
    ausentes: c.A,
    tardes: c.T,
    justificadas: c.J,
    inasistencias,
    porcentaje: clases ? redondear1(((clases - inasistencias) / clases) * 100) : null,
    concurrio: c.P + c.T > 0,
  };
}

// % de presentes en una clase (cuenta P y T como presentes)
export function porcentajePresentesClase(
  estados: EstadoAsistencia[],
): number | null {
  if (!estados.length) return null;
  const pres = estados.filter((e) => e === "P" || e === "T").length;
  return redondear1((pres / estados.length) * 100);
}

/* ---------------- Notas ---------------- */

export type NotaCalculo = {
  categoria: Categoria;
  valor: number;
  temaId?: number | null;
};

export type Pesos = Partial<Record<Categoria, number>>;

export const PESOS_POR_DEFECTO: Pesos = {
  participacion: 10,
  desempeno: 10,
  tp_escrito: 15,
  actividad_virtual: 10,
  oral: 5,
  quiz: 10,
  examen: 40,
};

export function promedio(valores: number[]): number | null {
  if (!valores.length) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

export function promediosPorCategoria(notas: NotaCalculo[]) {
  const grupos = new Map<Categoria, number[]>();
  for (const n of notas) {
    const g = grupos.get(n.categoria) ?? [];
    g.push(n.valor);
    grupos.set(n.categoria, g);
  }
  const out: Partial<Record<Categoria, number>> = {};
  for (const [cat, vals] of grupos) out[cat] = promedio(vals)!;
  return out;
}

/*
 * Calificación del cuatrimestre: promedio ponderado por categoría.
 * Si a una categoría todavía no le cargaste notas, su peso se reparte entre las demás.
 * Devuelve entero de 1 a 10 (redondeo: 6,5 → 7), o null si no hay notas.
 */
export function calificacionPonderada(
  notas: NotaCalculo[],
  pesos: Pesos = PESOS_POR_DEFECTO,
): { exacta: number; entera: number } | null {
  const prom = promediosPorCategoria(notas);
  let suma = 0;
  let pesoTotal = 0;
  for (const [cat, valor] of Object.entries(prom) as [Categoria, number][]) {
    const p = pesos[cat] ?? 0;
    if (p <= 0) continue;
    suma += valor * p;
    pesoTotal += p;
  }
  if (!pesoTotal) return null;
  const exacta = suma / pesoTotal;
  return { exacta: redondear1(exacta), entera: notaEntera(exacta) };
}

export function notaEntera(x: number): number {
  return Math.min(10, Math.max(1, Math.round(x + 1e-9)));
}

// TEA 7–10, TEP 4–6, TED 1–3 (criterio de la Res. 1650/24 y anteriores)
export function valoracionDesdeNota(nota: number): Valoracion {
  const n = notaEntera(nota);
  if (n >= 7) return "TEA";
  if (n >= 4) return "TEP";
  return "TED";
}

// Sugerencia para la valoración preliminar con las notas de los primeros dos meses
export function sugerirValoracion(
  notasPrimerosMeses: NotaCalculo[],
  pesos: Pesos = PESOS_POR_DEFECTO,
): Valoracion | null {
  const c = calificacionPonderada(notasPrimerosMeses, pesos);
  return c ? valoracionDesdeNota(c.exacta) : null;
}

/*
 * Casilleros "Calificaciones/valoraciones parciales" de la planilla (5 por cuatrimestre).
 * Un casillero por tema (promedio de las notas del tema) y el examen al final.
 * Si hay más temas que lugares, se agrupan temas consecutivos.
 */
export function parcialesParaPlanilla(
  notas: NotaCalculo[],
  ordenTemas: number[],
  lugares = 5,
): number[] {
  const examen = promedio(
    notas.filter((n) => n.categoria === "examen").map((n) => n.valor),
  );
  const porTema = ordenTemas
    .map((t) =>
      promedio(
        notas
          .filter((n) => n.categoria !== "examen" && n.temaId === t)
          .map((n) => n.valor),
      ),
    )
    .filter((v): v is number => v !== null);

  const libres = examen === null ? lugares : lugares - 1;
  let grupos: number[] = porTema;
  if (porTema.length > libres) {
    grupos = [];
    const tam = porTema.length / libres;
    for (let i = 0; i < libres; i++) {
      const tramo = porTema.slice(Math.round(i * tam), Math.round((i + 1) * tam));
      grupos.push(promedio(tramo)!);
    }
  }
  const out = grupos.map(notaEntera);
  if (examen !== null) out.push(notaEntera(examen));
  return out;
}

/* ---------------- Cuadro de totales de la planilla ---------------- */

export type FilaTotales = {
  total: number;
  aprobados: number;
  desaprobados: number;
  sinEvaluar: number;
};

// sinEvaluar: alumnos que no concurrieron a ninguna clase del período (punto 4 de la planilla)
export function totalesPeriodo(
  filas: { calificacion: number | null; concurrio: boolean }[],
): FilaTotales {
  let aprobados = 0;
  let desaprobados = 0;
  let sinEvaluar = 0;
  for (const f of filas) {
    if (!f.concurrio || f.calificacion === null) sinEvaluar++;
    else if (f.calificacion >= 7) aprobados++;
    else desaprobados++;
  }
  return { total: filas.length, aprobados, desaprobados, sinEvaluar };
}

function redondear1(x: number) {
  return Math.round(x * 10) / 10;
}
