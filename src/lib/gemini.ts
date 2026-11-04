// Lectura de fotos con Gemini (Google). La clave va en GEMINI_API_KEY (Vercel); el modelo se puede cambiar con GEMINI_MODELO.
// La foto se manda solo para leerla y no se guarda en ningún lado.
import "server-only";

const MODELO_POR_DEFECTO = "gemini-3.6-flash";
// GEMINI_URL_BASE solo para pruebas (un servidor falso); en la app real no se usa
const URL_BASE = process.env.GEMINI_URL_BASE?.trim() || "https://generativelanguage.googleapis.com/v1beta/models";

export type ResultadoLectura<T> =
  | { ok: true; datos: T }
  | { ok: false; motivo: "sin-clave" | "cuota" | "ilegible" | "error"; detalle?: string };

export function geminiConfigurado() {
  return !!process.env.GEMINI_API_KEY?.trim();
}

// Saca el JSON aunque venga envuelto en ```json … ```
function extraerJson(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const ini = limpio.search(/[[{]/);
  return JSON.parse(ini > 0 ? limpio.slice(ini) : limpio);
}

export async function leerFoto<T>(opciones: {
  imagenBase64: string;
  mime: string;
  instrucciones: string;
  esquema: Record<string, unknown>; // JSON Schema de la respuesta
}): Promise<ResultadoLectura<T>> {
  const clave = process.env.GEMINI_API_KEY?.trim();
  if (!clave) return { ok: false, motivo: "sin-clave" };
  const modelo = process.env.GEMINI_MODELO?.trim() || MODELO_POR_DEFECTO;

  const cuerpo = (conEsquema: boolean) => ({
    contents: [
      {
        role: "user",
        parts: [{ text: opciones.instrucciones }, { inlineData: { mimeType: opciones.mime, data: opciones.imagenBase64 } }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      ...(conEsquema ? { responseJsonSchema: opciones.esquema } : {}),
    },
  });

  const pedir = (conEsquema: boolean) =>
    fetch(`${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      body: JSON.stringify(cuerpo(conEsquema)),
      signal: AbortSignal.timeout(55000),
      cache: "no-store",
    });

  try {
    let r = await pedir(true);
    // Si el modelo no acepta el esquema, se pide solo JSON (el esquema igual va descrito en las instrucciones)
    if (r.status === 400) {
      const t = await r.text();
      if (/schema/i.test(t)) r = await pedir(false);
      else return { ok: false, motivo: "error", detalle: `Gemini respondió 400: ${t.slice(0, 300)}` };
    }
    if (r.status === 429) return { ok: false, motivo: "cuota" };
    if (r.status === 401 || r.status === 403) return { ok: false, motivo: "error", detalle: "La clave de Gemini no es válida o no tiene permiso." };
    if (!r.ok) return { ok: false, motivo: "error", detalle: `Gemini respondió ${r.status}` };
    const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const texto = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!texto.trim()) return { ok: false, motivo: "ilegible" };
    return { ok: true, datos: extraerJson(texto) as T };
  } catch (e) {
    return { ok: false, motivo: "error", detalle: e instanceof Error ? e.message : "No se pudo leer la foto" };
  }
}

export const MENSAJE_LECTURA: Record<"sin-clave" | "cuota" | "ilegible" | "error", string> = {
  "sin-clave": "Falta la clave de Gemini (GEMINI_API_KEY) en la configuración de la app.",
  cuota: "Se llegó al límite gratis de Gemini por hoy (o por este minuto). Probá en un rato.",
  ilegible: "No se pudo leer nada en la foto. Probá con más luz, de frente y que se vea toda la hoja.",
  error: "No se pudo leer la foto.",
};
