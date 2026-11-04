// Qué se le pide a Gemini para cada tipo de foto, y cómo se limpia lo que devuelve
import "server-only";
import { z } from "zod";
import { leerFoto } from "./gemini";

export const pedidoFoto = z.object({
  imagen: z.string().min(100).max(6_000_000), // base64 de la foto ya achicada en el celu
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
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
La foto muestra una lista de estudiantes (puede ser escrita a mano o impresa, a veces con números de orden).
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
La foto muestra una tabla: cada fila es un estudiante y cada columna de notas es una evaluación.
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
