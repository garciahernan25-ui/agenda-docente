// Qué se le pide a Gemini para cada tipo de foto, y cómo se limpia lo que devuelve
import "server-only";
import { z } from "zod";
import { leerFoto } from "./gemini";

export const pedidoFoto = z.object({
  imagen: z.string().min(100).max(6_000_000), // base64 de la foto ya achicada en el celu
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});

/* ---------- Lista de alumnos ---------- */

const ESQUEMA_LISTA = {
  type: "object",
  properties: {
    alumnos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          apellido: { type: "string" },
          nombre: { type: "string" },
          tachado: { type: "boolean" },
          dudoso: { type: "boolean" },
        },
        required: ["apellido", "nombre", "tachado", "dudoso"],
      },
    },
  },
  required: ["alumnos"],
};

const INSTRUCCIONES_LISTA = `Sos un asistente que transcribe listas de alumnos de escuelas argentinas.
La foto (o el PDF, que puede tener varias páginas) muestra una lista de estudiantes (puede ser escrita a mano o impresa, a veces con números de orden).
Devolvé SOLO un JSON con esta forma: {"alumnos":[{"apellido":"...","nombre":"...","tachado":false,"dudoso":false}]}.
Reglas:
- Un elemento por estudiante, en el mismo orden de la hoja. Ignorá títulos, fechas, encabezados y renglones vacíos.
- Separá apellido y nombre. Si está escrito "APELLIDO, Nombre" es claro; si no hay coma, en listas escolares suele ir primero el apellido.
- Apellido en MAYÚSCULAS; nombre con mayúscula inicial. Respetá tildes y la ñ cuando se vean.
- "tachado": true si el renglón está tachado o marcado como baja.
- "dudoso": true si alguna letra no se lee con seguridad. No inventes nombres: transcribí lo que ves.`;

export type AlumnoLeido = { apellido: string; nombre: string; tachado: boolean; dudoso: boolean };

export async function leerLista(imagen: string, mime: string) {
  const r = await leerFoto<{ alumnos?: AlumnoLeido[] }>({ imagenBase64: imagen, mime, instrucciones: INSTRUCCIONES_LISTA, esquema: ESQUEMA_LISTA });
  if (!r.ok) return r;
  const alumnos = (r.datos.alumnos ?? [])
    .map((a) => ({
      apellido: String(a.apellido ?? "").trim().toUpperCase(),
      nombre: String(a.nombre ?? "").trim(),
      tachado: !!a.tachado,
      dudoso: !!a.dudoso,
    }))
    .filter((a) => a.apellido || a.nombre)
    .slice(0, 80);
  if (!alumnos.length) return { ok: false as const, motivo: "ilegible" as const };
  return { ok: true as const, datos: alumnos };
}

/* ---------- Planilla de notas ---------- */

const ESQUEMA_NOTAS = {
  type: "object",
  properties: {
    columnas: { type: "array", items: { type: "string" } },
    filas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numero: { type: "string" },
          nombre: { type: "string" },
          valores: { type: "array", items: { type: "string" } },
          dudoso: { type: "boolean" },
        },
        required: ["numero", "nombre", "valores", "dudoso"],
      },
    },
  },
  required: ["columnas", "filas"],
};

const INSTRUCCIONES_NOTAS = `Sos un asistente que transcribe planillas de notas de escuelas argentinas (escala 1 a 10, a veces con decimales como 7,5).
La foto (o el PDF, que puede tener varias páginas: juntá las filas de todas) muestra una tabla: cada fila es un estudiante y cada columna de notas es una evaluación.
Devolvé SOLO un JSON con esta forma:
{"columnas":["encabezado col 1","encabezado col 2",...],"filas":[{"numero":"1","nombre":"PÉREZ, Juan","valores":["8","7,5",""],"dudoso":false}]}
Reglas:
- "columnas": SOLO las columnas de notas (no la del número ni la del nombre), con su encabezado tal cual (fecha, "TP1", "Oral", etc.; "" si no tiene).
- "filas": una por estudiante, en el orden de la hoja. "numero" es el número de orden si está escrito ("" si no). "nombre" tal cual se lee.
- "valores": una entrada por cada columna de "columnas", en el mismo orden. Copiá la nota como está escrita ("8", "7,5", "10"). Si la celda está vacía, "". Si dice "A", "aus", "-" u otra cosa que no es número, copiala igual.
- "dudoso": true si alguna nota o el nombre de esa fila no se lee con seguridad. No inventes: transcribí lo que ves.`;

export type PlanillaLeida = { columnas: string[]; filas: { numero: string; nombre: string; valores: string[]; dudoso: boolean }[] };

export async function leerPlanilla(imagen: string, mime: string) {
  const r = await leerFoto<Partial<PlanillaLeida>>({ imagenBase64: imagen, mime, instrucciones: INSTRUCCIONES_NOTAS, esquema: ESQUEMA_NOTAS });
  if (!r.ok) return r;
  const columnas = (r.datos.columnas ?? []).map((c) => String(c ?? "").trim()).slice(0, 20);
  const filas = (r.datos.filas ?? [])
    .map((f) => ({
      numero: String(f.numero ?? "").trim(),
      nombre: String(f.nombre ?? "").trim(),
      valores: columnas.map((_, i) => String(f.valores?.[i] ?? "").trim()),
      dudoso: !!f.dudoso,
    }))
    .filter((f) => f.nombre || f.numero)
    .slice(0, 80);
  if (!filas.length || !columnas.length) return { ok: false as const, motivo: "ilegible" as const };
  return { ok: true as const, datos: { columnas, filas } };
}

/* ---------- Planilla oficial de calificaciones (DGCyE) ---------- */

const CELDAS = { type: "array", items: { type: "string" } };
const ESQUEMA_OFICIAL = {
  type: "object",
  properties: {
    filas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numero: { type: "string" },
          nombre: { type: "string" },
          parciales1: CELDAS,
          valoracion1: { type: "string" },
          calificacion1: { type: "string" },
          inasistencias1: { type: "string" },
          parciales2: CELDAS,
          valoracion2: { type: "string" },
          calificacion2: { type: "string" },
          intensificacion1: { type: "string" },
          inasistencias2: { type: "string" },
          tachado: { type: "boolean" },
          observacion: { type: "string" },
          dudoso: { type: "boolean" },
        },
        required: ["numero", "nombre", "parciales1", "valoracion1", "calificacion1", "inasistencias1", "parciales2", "valoracion2", "calificacion2", "intensificacion1", "inasistencias2", "tachado", "observacion", "dudoso"],
      },
    },
  },
  required: ["filas"],
};

const INSTRUCCIONES_OFICIAL = `Sos un asistente que transcribe la "Planilla de calificaciones" oficial de secundaria de la Provincia de Buenos Aires (DGCyE).
La foto (o el PDF, que puede tener varias páginas: juntá las filas de todas) es esa planilla, completada a mano, muchas veces con biromes de distintos colores. Cada fila es un estudiante: N° de orden (viene impreso a la izquierda, del 1 al 40), apellido y nombre, la columna "Cursa o recursa" (ignorala), y después:
- 1° cuatrimestre: 5 casilleros chicos de "Calificaciones/valoraciones parciales"; "1° Valoración preliminar" (TEA, TEP o TED); "Calificación 1° cuatrimestre"; "Inasistencias del 1° cuatrimestre".
- 2° cuatrimestre: 5 casilleros chicos de parciales; "2° Valoración preliminar"; "Calificación 2° cuatrimestre"; "Intensificación 1° cuatrimestre"; "Inasistencias del 2° cuatrimestre".
Las columnas de Intensificación diciembre/febrero y "Calificación final" ignoralas.
Devolvé SOLO un JSON: {"filas":[{"numero":"1","nombre":"PÉREZ, Juan","parciales1":["7","8","","",""],"valoracion1":"TEA","calificacion1":"7","inasistencias1":"3,5","parciales2":["6","","","",""],"valoracion2":"","calificacion2":"","intensificacion1":"","inasistencias2":"","tachado":false,"observacion":"","dudoso":false}]}
Reglas:
- Fijate bien en qué columna cae cada valor guiándote por las líneas verticales de la planilla: muchas veces los parciales están vacíos y solo hay valoración y calificación. Un valor escrito en "Valoración" o "Calificación" NO va en parciales.
- parciales1 y parciales2 tienen siempre 5 elementos, en el orden de los casilleros; "" si el casillero está vacío.
- Valoración: solo puede ser "TEA", "TEP" o "TED". Si la letra del medio no se lee bien (ej. parece "TCA"), poné la más parecida de las tres y marcá "dudoso": true.
- Notas: números del 1 al 10, copialos como están ("7", "7,5"). Ojo: a mano el 7 suele llevar una rayita en el medio y puede parecer una cruz (+) o una "t": es un 7. El 1 puede tener un ganchito arriba.
- Celda vacía = "".
- "tachado": true si el nombre del estudiante está tachado con una línea (a veces roja) que cruza la fila: es alguien que dejó el curso. Incluilo igual, con lo que tenga escrito.
- "observacion": si al costado de la fila, fuera de las columnas, hay una anotación corta (ej. "T.M", "pase", "salió"), copiala; si no, "".
- Ignorá las filas vacías de abajo y el cuadro de totales del pie de página.
- "dudoso": true si algo de esa fila no se lee con seguridad. No inventes: transcribí lo que ves.`;

export type FilaOficial = {
  numero: string;
  nombre: string;
  parciales1: string[];
  valoracion1: string;
  calificacion1: string;
  inasistencias1: string;
  parciales2: string[];
  valoracion2: string;
  calificacion2: string;
  intensificacion1: string;
  inasistencias2: string;
  tachado: boolean;
  observacion: string;
  dudoso: boolean;
};

export async function leerPlanillaOficial(imagen: string, mime: string) {
  const r = await leerFoto<{ filas?: Partial<FilaOficial>[] }>({ imagenBase64: imagen, mime, instrucciones: INSTRUCCIONES_OFICIAL, esquema: ESQUEMA_OFICIAL });
  if (!r.ok) return r;
  const t = (v: unknown) => String(v ?? "").trim();
  const cinco = (a: unknown) => Array.from({ length: 5 }, (_, i) => t(Array.isArray(a) ? a[i] : ""));
  const filas: FilaOficial[] = (r.datos.filas ?? [])
    .map((f) => ({
      numero: t(f.numero),
      nombre: t(f.nombre),
      parciales1: cinco(f.parciales1),
      valoracion1: t(f.valoracion1).toUpperCase(),
      calificacion1: t(f.calificacion1),
      inasistencias1: t(f.inasistencias1),
      parciales2: cinco(f.parciales2),
      valoracion2: t(f.valoracion2).toUpperCase(),
      calificacion2: t(f.calificacion2),
      intensificacion1: t(f.intensificacion1),
      inasistencias2: t(f.inasistencias2),
      tachado: !!f.tachado,
      observacion: t(f.observacion).slice(0, 40),
      dudoso: !!f.dudoso,
    }))
    .filter((f) => f.nombre || f.numero)
    .slice(0, 60);
  if (!filas.length) return { ok: false as const, motivo: "ilegible" as const };
  return { ok: true as const, datos: filas };
}
