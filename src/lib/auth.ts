import "server-only";
import { scrypt, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { COOKIE_SESION, crearTokenSesion, DURACION_SESION_S, tokenValido } from "./sesion";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// Formato del hash: scrypt:<salt hex>:<hash hex>  (se genera con `npm run clave`; sin "$" porque .env los expande)
export async function hashClave(clave: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scryptAsync(clave, salt, 32);
  return `scrypt:${salt.toString("hex")}:${h.toString("hex")}`;
}

export async function verificarClave(clave: string, guardado: string | undefined): Promise<boolean> {
  if (!guardado) return false;
  const [alg, saltHex, hashHex] = guardado.split(":");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const h = await scryptAsync(clave, Buffer.from(saltHex, "hex"), esperado.length);
  return h.length === esperado.length && timingSafeEqual(h, esperado);
}

export async function iniciarSesion() {
  (await cookies()).set(COOKIE_SESION, await crearTokenSesion(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_S,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_SESION);
}

export async function haySesion(): Promise<boolean> {
  await connection(); // siempre en el momento del pedido, nunca prerenderizado
  return tokenValido((await cookies()).get(COOKIE_SESION)?.value);
}

// Para páginas y acciones: si no hay sesión, al login
export async function exigirDocente() {
  if (!(await haySesion())) redirect("/login");
}

// Para rutas de API: devuelve una respuesta 401 o null si está todo bien
export async function noAutorizado(): Promise<Response | null> {
  return (await haySesion()) ? null : Response.json({ error: "Sin sesión" }, { status: 401 });
}
