/*
 * Planilla de Calificaciones oficial (DGCyE, modelo 2.1).
 * Usa el PDF original como fondo y escribe los datos en cada casillero,
 * así sale idéntica a la que recibe la preceptora.
 * Coordenadas medidas en puntos sobre la plantilla A4 (595.92 × 842.88),
 * con "top" contado desde arriba como en el visor.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { FilaTotales } from "@/lib/calculos";
import type { Valoracion } from "@/db/schema";

export type FilaPlanilla = {
  orden: number;
  apellidoNombre: string;
  cursaRecursa: "C" | "R";
  observacion?: string | null;
  parciales1: (number | string)[];
  valoracion1?: Valoracion | null;
  calificacion1?: number | null;
  inasistencias1?: number | null;
  parciales2: (number | string)[];
  valoracion2?: Valoracion | null;
  calificacion2?: number | null;
  intensificacion1?: number | null;
  inasistencias2?: number | null;
  diciembre?: number | null;
  febrero?: number | null;
  calificacionFinal?: number | null;
};

export type DatosPlanilla = {
  escuela: string;
  cicloLectivo: number;
  materia: string;
  profesor: string;
  anio: string;
  seccion: string;
  turno: string;
  preceptor?: string | null;
  filas: FilaPlanilla[];
  totales?: {
    c1?: FilaTotales;
    c2?: FilaTotales;
    total?: FilaTotales;
    dic?: FilaTotales;
    feb?: FilaTotales;
  };
  clases?: {
    totales1?: number | null;
    totales2?: number | null;
    dadas1?: number | null;
    dadas2?: number | null;
  };
};

const H = 842.88;
const FILAS = 40;
const FILA1_BASE = 200.6; // línea de base del texto en la fila 1
const PASO_FILA = 11.8;
const TINTA = rgb(0.1, 0.16, 0.54);

// [x izquierda, x derecha] de cada columna
const COL = {
  nombre: [59.6, 188.9],
  cr: [188.9, 217.7],
  val1: [280.1, 301.2],
  cal1: [301.2, 321.9],
  ina1: [321.9, 343.3],
  val2: [405.6, 426.7],
  cal2: [426.7, 447.4],
  int1: [447.4, 468.6],
  ina2: [468.6, 489.3],
  dic: [489.3, 510.4],
  feb: [510.4, 531.2],
  final: [531.2, 553.2],
} as const;
const PARCIALES1 = [217.7, 230.2, 242.7, 255.1, 267.6, 280.1];
const PARCIALES2 = [343.3, 356.5, 369.0, 381.5, 394.0, 405.6];

// Cuadro de totales (centro de cada columna, base de cada fila)
const TOT_X = { c1: 127, c2: 150, total: 172.5, dic: 195, feb: 217 };
const TOT_Y = [710.6, 722.5, 734.4, 746.3];
const CLASES_X = { c1: 196, c2: 220 };
const CLASES_Y = { totales: 802.5, dadas: 813.8 };

export async function generarPlanillaCalificaciones(
  plantilla: Uint8Array,
  d: DatosPlanilla,
): Promise<Uint8Array> {
  if (d.filas.length > FILAS) {
    throw new Error(`La planilla oficial tiene ${FILAS} filas y hay ${d.filas.length} alumnos`);
  }
  const pdf = await PDFDocument.load(plantilla);
  const page = pdf.getPage(0);
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const fb = await pdf.embedFont(StandardFonts.HelveticaBold);

  const izq = (x: number, top: number, s: string, size = 8, font = f) =>
    page.drawText(s, { x, y: H - top, size, font, color: TINTA });

  // Encabezado
  izq(160, 35.5, d.escuela, 9);
  izq(352, 56, String(d.cicloLectivo).slice(-2), 9, fb);
  izq(76, 76.5, d.materia);
  izq(341, 76.5, d.profesor);
  izq(70, 94.5, d.anio);
  izq(142, 94.5, d.seccion);
  izq(218, 94.5, d.turno);
  if (d.preceptor) izq(343, 94.5, d.preceptor);

  for (const fila of d.filas) {
    const top = FILA1_BASE + PASO_FILA * (fila.orden - 1);
    const nombre = ajustar(fila.apellidoNombre, f, 7, COL.nombre[1] - COL.nombre[0] - 4);
    izq(COL.nombre[0] + 2, top, nombre, 7);
    if (fila.observacion) {
      // fuera de la tabla, a la derecha, como se anota a mano
      izq(556, top, ajustar(fila.observacion, f, 6, 36), 6);
    }
    const celda = (col: readonly [number, number], v: unknown, size = 7) =>
      centrado(page, f, col, top, v, size);
    celda(COL.cr, fila.cursaRecursa);
    celda(COL.val1, fila.valoracion1, 6.5);
    celda(COL.cal1, fila.calificacion1);
    celda(COL.ina1, fila.inasistencias1);
    celda(COL.val2, fila.valoracion2, 6.5);
    celda(COL.cal2, fila.calificacion2);
    celda(COL.int1, fila.intensificacion1);
    celda(COL.ina2, fila.inasistencias2);
    celda(COL.dic, fila.diciembre);
    celda(COL.feb, fila.febrero);
    celda(COL.final, fila.calificacionFinal);
    fila.parciales1.slice(0, 5).forEach((v, i) =>
      centrado(page, f, [PARCIALES1[i], PARCIALES1[i + 1]], top, v, 6.5),
    );
    fila.parciales2.slice(0, 5).forEach((v, i) =>
      centrado(page, f, [PARCIALES2[i], PARCIALES2[i + 1]], top, v, 6.5),
    );
  }

  const t = d.totales ?? {};
  for (const k of Object.keys(TOT_X) as (keyof typeof TOT_X)[]) {
    const fila = t[k];
    if (!fila) continue;
    [fila.total, fila.aprobados, fila.desaprobados, fila.sinEvaluar].forEach((v, i) =>
      centradoEn(page, f, TOT_X[k], TOT_Y[i], v, 8),
    );
  }
  const c = d.clases ?? {};
  centradoEn(page, f, CLASES_X.c1, CLASES_Y.totales, c.totales1, 8);
  centradoEn(page, f, CLASES_X.c2, CLASES_Y.totales, c.totales2, 8);
  centradoEn(page, f, CLASES_X.c1, CLASES_Y.dadas, c.dadas1, 8);
  centradoEn(page, f, CLASES_X.c2, CLASES_Y.dadas, c.dadas2, 8);

  return pdf.save();
}

function centrado(
  page: PDFPage,
  font: PDFFont,
  [a, b]: readonly [number, number],
  top: number,
  v: unknown,
  size: number,
) {
  centradoEn(page, font, (a + b) / 2, top, v, size);
}

function centradoEn(page: PDFPage, font: PDFFont, cx: number, top: number, v: unknown, size: number) {
  if (v === null || v === undefined || v === "") return;
  const s = formatear(v);
  const w = font.widthOfTextAtSize(s, size);
  page.drawText(s, { x: cx - w / 2, y: H - top, size, font, color: TINTA });
}

// Inasistencias con media falta: 2.5 → "2½"
function formatear(v: unknown): string {
  if (typeof v === "number" && !Number.isInteger(v)) {
    const ent = Math.floor(v);
    return Math.abs(v - ent - 0.5) < 1e-9 ? `${ent || ""}½` : v.toFixed(1).replace(".", ",");
  }
  return String(v);
}

function ajustar(s: string, font: PDFFont, size: number, max: number) {
  if (font.widthOfTextAtSize(s, size) <= max) return s;
  let out = s;
  while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > max) out = out.slice(0, -1);
  return out + "…";
}
