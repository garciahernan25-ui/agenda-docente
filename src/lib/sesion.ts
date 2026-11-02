/*
 * Sesión del docente: cookie firmada con HMAC-SHA256 (Web Crypto, anda en el proxy y en Node).
 * Contenido: fecha de vencimiento. No hay usuarios: la app es de un solo docente.
 */
export const COOKIE_SESION = "agenda_sesion";
export const DURACION_SESION_S = 60 * 60 * 24 * 30; // 30 días, para no loguearte a cada rato en el celu

function secreto(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres)");
    return "solo-para-desarrollo-local-no-usar-en-produccion";
  }
  return s;
}

const enc = new TextEncoder();

async function clave() {
  return crypto.subtle.importKey("raw", enc.encode(secreto()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function desdeB64url(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

export async function crearTokenSesion(ahora = Date.now()): Promise<string> {
  const vence = String(Math.floor(ahora / 1000) + DURACION_SESION_S);
  const firma = await crypto.subtle.sign("HMAC", await clave(), enc.encode(vence));
  return `${vence}.${b64url(firma)}`;
}

export async function tokenValido(token: string | undefined, ahora = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [vence, firma] = token.split(".");
  if (!vence || !firma || !/^\d+$/.test(vence)) return false;
  if (Number(vence) * 1000 < ahora) return false;
  try {
    return await crypto.subtle.verify("HMAC", await clave(), desdeB64url(firma), enc.encode(vence));
  } catch {
    return false;
  }
}
