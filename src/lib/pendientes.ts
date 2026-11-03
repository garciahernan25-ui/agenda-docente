// Cola de cambios cargados sin señal (en el celu). La usa la app y también public/sin-conexion.js,
// que repite estas mismas claves: si cambiás algo acá, cambialo allá.
"use client";

export const CLAVE_DATOS = "agenda.datos";
export const CLAVE_PENDIENTES = "agenda.pendientes";
export const CLAVE_ERRORES = "agenda.errores";
export const EVENTO = "agenda:pendientes";

export type Pendiente =
  | {
      uid: string;
      tipo: "asistencia";
      creado: string;
      descripcion: string;
      asignacionId: number;
      fecha: string;
      dictada: boolean;
      temaId?: number | null;
      registros: { inscripcionId: number; estado: "P" | "A" | "T" | "J" }[];
    }
  | {
      uid: string;
      tipo: "celdas";
      creado: string;
      descripcion: string;
      asignacionId: number;
      temaId: number;
      fecha: string;
      celdas: { inscripcionId: number; categoria: string; valor: number | null }[];
    };

type SinUid<T> = T extends unknown ? Omit<T, "uid" | "creado"> : never;
export type ErrorEnvio = { descripcion: string; error: string; cuando: string };

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const t = localStorage.getItem(clave);
    return t ? (JSON.parse(t) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}
function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // sin espacio o almacenamiento bloqueado: no hay nada más que hacer
  }
  window.dispatchEvent(new Event(EVENTO));
}

export const pendientes = () => leer<Pendiente[]>(CLAVE_PENDIENTES, []);
export const errores = () => leer<ErrorEnvio[]>(CLAVE_ERRORES, []);
export const borrarErrores = () => escribir(CLAVE_ERRORES, []);

export function encolar(item: SinUid<Pendiente>) {
  const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  escribir(CLAVE_PENDIENTES, [...pendientes(), { ...item, uid, creado: new Date().toISOString() }]);
}

// Una falla de red (sin señal, o se cortó a mitad de camino), y no un error de la app
export function esFallaDeRed(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = e instanceof Error ? e.message : String(e);
  return e instanceof TypeError || /fetch|network|failed to|load failed|conexi/i.test(m);
}

let enviando = false;

// Manda lo que haya en la cola. Devuelve cuántos quedaron sin mandar.
export async function enviarPendientes(): Promise<{ enviados: number; quedan: number; sinSesion?: boolean }> {
  const cola = pendientes();
  if (!cola.length || enviando) return { enviados: 0, quedan: cola.length };
  enviando = true;
  try {
    const r = await fetch("/api/sin-conexion/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cola }),
      cache: "no-store",
    });
    if (r.status === 401) return { enviados: 0, quedan: cola.length, sinSesion: true };
    if (!r.ok) return { enviados: 0, quedan: cola.length };
    const { resultados } = (await r.json()) as { resultados: { uid: string; ok: boolean; error?: string }[] };
    const listos = new Set(resultados.map((x) => x.uid));
    const fallidos = resultados.filter((x) => !x.ok);
    if (fallidos.length) {
      const porUid = new Map(cola.map((c) => [c.uid, c]));
      escribir(CLAVE_ERRORES, [
        ...errores(),
        ...fallidos.map((f) => ({ descripcion: porUid.get(f.uid)?.descripcion ?? "Un cambio", error: f.error ?? "No se pudo guardar", cuando: new Date().toISOString() })),
      ]);
    }
    // Saca de la cola lo que el servidor ya procesó (bien o mal); lo que se agregó mientras tanto queda
    const resto = pendientes().filter((c) => !listos.has(c.uid));
    escribir(CLAVE_PENDIENTES, resto);
    return { enviados: resultados.length - fallidos.length, quedan: resto.length };
  } catch {
    return { enviados: 0, quedan: cola.length };
  } finally {
    enviando = false;
  }
}

// Baja al celu lo necesario para dar clase sin señal
export async function actualizarDatos() {
  try {
    const r = await fetch("/api/sin-conexion/datos", { cache: "no-store" });
    if (!r.ok) return false;
    const datos = await r.json();
    try {
      localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
    } catch {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
