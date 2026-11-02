/*
 * Planilla de asistencia: alumnos en filas, fechas de clase en columnas,
 * inasistencias y % por alumno, % de presentes por clase.
 * A4 apaisada; si hay muchas fechas se parte en varias hojas.
 */
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { EstadoAsistencia } from "@/db/schema";
import { porcentajePresentesClase, resumenAsistencia } from "@/lib/calculos";

export type DatosAsistencia = {
  escuela: string;
  materia: string;
  profesor: string;
  curso: string; // "2° C – Vespertino"
  periodo: string; // "1° cuatrimestre 2026"
  fechas: string[]; // YYYY-MM-DD, solo clases dictadas
  alumnos: {
    orden: number;
    apellidoNombre: string;
    baja?: boolean;
    estados: (EstadoAsistencia | null)[]; // mismo largo que fechas
  }[];
};

const W = 841.89;
const H = 595.28;
const M = 28;
const COL_ORDEN = 18;
const COL_NOMBRE = 150;
const COL_RESUMEN = [34, 34, 38]; // Inas. / Just. / %
const ALTO_FILA = 12;
const ALTO_CAB = 46;
const MAX_FECHAS = 26;

const NEGRO = rgb(0, 0, 0);
const GRIS = rgb(0.45, 0.45, 0.45);
const LINEA = rgb(0.6, 0.6, 0.6);
const ROJO = rgb(0.75, 0.1, 0.1);

export async function generarPlanillaAsistencia(d: DatosAsistencia): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const fb = await pdf.embedFont(StandardFonts.HelveticaBold);

  const bloques: number[][] = [];
  // Reparte las fechas en partes parejas (34 fechas → 17 + 17, no 26 + 8)
  const partes = Math.max(1, Math.ceil(d.fechas.length / MAX_FECHAS));
  const porHoja = Math.max(1, Math.ceil(d.fechas.length / partes));
  for (let i = 0; i < Math.max(d.fechas.length, 1); i += porHoja) {
    bloques.push(d.fechas.map((_, j) => j).slice(i, i + porHoja));
  }
  const filasPorHoja = Math.floor((H - 2 * M - 70 - ALTO_CAB - ALTO_FILA * 2) / ALTO_FILA);

  // Resumen de todo el período (no solo de la hoja)
  const resumen = d.alumnos.map((a) =>
    resumenAsistencia(a.estados.filter((e): e is EstadoAsistencia => !!e)),
  );

  for (let b = 0; b < bloques.length; b++) {
    for (let desde = 0; desde < Math.max(d.alumnos.length, 1); desde += filasPorHoja) {
      const page = pdf.addPage([W, H]);
      const idx = bloques[b];
      const ultimoBloque = b === bloques.length - 1;
      dibujarHoja(page, f, fb, d, idx, desde, Math.min(desde + filasPorHoja, d.alumnos.length), ultimoBloque, resumen);
    }
  }
  const n = pdf.getPageCount();
  pdf.getPages().forEach((p, i) =>
    p.drawText(`Hoja ${i + 1} de ${n}`, { x: W - M - 50, y: M - 14, size: 7, font: f, color: GRIS }),
  );
  return pdf.save();
}

function dibujarHoja(
  page: PDFPage,
  f: PDFFont,
  fb: PDFFont,
  d: DatosAsistencia,
  idx: number[],
  desde: number,
  hasta: number,
  conResumen: boolean,
  resumen: ReturnType<typeof resumenAsistencia>[],
) {
  const txt = (s: string, x: number, y: number, size = 8, font = f, color = NEGRO) =>
    page.drawText(s, { x, y, size, font, color });

  txt("PLANILLA DE ASISTENCIA", M, H - M - 10, 12, fb);
  txt(`${d.escuela}  ·  ${d.materia}  ·  ${d.curso}`, M, H - M - 26, 9);
  txt(`Profesor/a: ${d.profesor}  ·  ${d.periodo}`, M, H - M - 39, 9);
  txt("P presente · A ausente · T tarde (½ falta) · J justificada (no suma)", W - M - 290, H - M - 26, 7.5, f, GRIS);

  const anchoResumen = conResumen ? COL_RESUMEN.reduce((a, b) => a + b, 0) : 0;
  const anchoFechas = W - 2 * M - COL_ORDEN - COL_NOMBRE - anchoResumen;
  const colF = idx.length ? anchoFechas / idx.length : 0;
  const x0 = M;
  const xF = x0 + COL_ORDEN + COL_NOMBRE;
  const xR = xF + anchoFechas;
  let y = H - M - 60;

  // Cabecera
  const yCab = y - ALTO_CAB;
  rect(page, x0, yCab, W - 2 * M, ALTO_CAB);
  txt("N°", x0 + 4, yCab + 6, 7, fb);
  txt("APELLIDO Y NOMBRE", x0 + COL_ORDEN + 4, yCab + 6, 7, fb);
  idx.forEach((j, k) => {
    const [, mes, dia] = d.fechas[j].split("-");
    const cx = xF + colF * k + colF / 2;
    page.drawText(`${dia}/${mes}`, { x: cx + 2.5, y: yCab + 5, size: 7, font: fb, rotate: degrees(90) });
  });
  if (conResumen) {
    ["Inas.", "Just.", "% Asist."].forEach((s, k) => {
      const x = xR + COL_RESUMEN.slice(0, k).reduce((a, b) => a + b, 0);
      txt(s, x + 3, yCab + 6, 7, fb);
    });
  }
  y = yCab;

  // Filas
  for (let i = desde; i < hasta; i++) {
    const a = d.alumnos[i];
    const r = resumen[i];
    y -= ALTO_FILA;
    const color = a.baja ? GRIS : NEGRO;
    txt(String(a.orden), x0 + 4, y + 3.5, 7, f, color);
    txt(a.apellidoNombre + (a.baja ? " (baja)" : ""), x0 + COL_ORDEN + 4, y + 3.5, 7, f, color);
    idx.forEach((j, k) => {
      const e = a.estados[j];
      if (!e) return;
      const s = e;
      const w = fb.widthOfTextAtSize(s, 7);
      txt(s, xF + colF * k + colF / 2 - w / 2, y + 3.5, 7, e === "P" ? f : fb, e === "A" ? ROJO : color);
    });
    if (conResumen) {
      const vals = [fmt(r.inasistencias), String(r.justificadas), r.porcentaje === null ? "" : `${fmt(r.porcentaje)}%`];
      vals.forEach((s, k) => {
        const x = xR + COL_RESUMEN.slice(0, k).reduce((a, b) => a + b, 0);
        const bajo = k === 2 && r.porcentaje !== null && r.porcentaje < 75;
        txt(s, x + 4, y + 3.5, 7, bajo ? fb : f, bajo ? ROJO : color);
      });
    }
    hline(page, x0, W - M, y);
  }

  // % de presentes por clase (en la última hoja de alumnos)
  if (hasta === d.alumnos.length) {
    y -= ALTO_FILA;
    txt(conResumen ? "% presentes · promedio curso" : "% presentes en la clase", x0 + COL_ORDEN + 4, y + 3.5, 7, fb);
    idx.forEach((j, k) => {
      const est = d.alumnos.filter((a) => !a.baja).map((a) => a.estados[j]).filter((e): e is EstadoAsistencia => !!e);
      const p = porcentajePresentesClase(est);
      if (p === null) return;
      const s = String(Math.round(p));
      const w = f.widthOfTextAtSize(s, 6.5);
      txt(s, xF + colF * k + colF / 2 - w / 2, y + 3.5, 6.5);
    });
    if (conResumen) {
      const activos = resumen.filter((_, i) => !d.alumnos[i].baja && resumen[i].porcentaje !== null);
      const prom = activos.length ? activos.reduce((s, r) => s + r.porcentaje!, 0) / activos.length : null;
      if (prom !== null) txt(`${fmt(Math.round(prom * 10) / 10)}%`, xR + COL_RESUMEN[0] + COL_RESUMEN[1] + 4, y + 3.5, 7, fb);
    }
    hline(page, x0, W - M, y);
  }

  // Grilla vertical
  const yTop = yCab + ALTO_CAB;
  rect(page, x0, y, W - 2 * M, yTop - y);
  vline(page, x0 + COL_ORDEN, y, yTop);
  vline(page, xF, y, yTop);
  idx.forEach((_, k) => k && vline(page, xF + colF * k, y, yTop));
  if (conResumen) {
    let x = xR;
    for (const w of COL_RESUMEN) {
      vline(page, x, y, yTop);
      x += w;
    }
  }
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
const rect = (p: PDFPage, x: number, y: number, w: number, h: number) =>
  p.drawRectangle({ x, y, width: w, height: h, borderColor: LINEA, borderWidth: 0.6 });
const hline = (p: PDFPage, x1: number, x2: number, y: number) =>
  p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.4, color: LINEA });
const vline = (p: PDFPage, x: number, y1: number, y2: number) =>
  p.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: 0.4, color: LINEA });
