// En el celu: achica la foto antes de mandarla (las fotos del teléfono pesan varios MB)
"use client";

export async function achicarFoto(archivo: File, ladoMax = 1800): Promise<{ imagen: string; mime: "image/jpeg" }> {
  const bmp = await createImageBitmap(archivo); // respeta la orientación de la foto
  const escala = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);
  const lienzo = document.createElement("canvas");
  lienzo.width = w;
  lienzo.height = h;
  lienzo.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const url = lienzo.toDataURL("image/jpeg", 0.85);
  return { imagen: url.slice(url.indexOf(",") + 1), mime: "image/jpeg" };
}

export async function mandarFoto<T>(ruta: string, archivo: File): Promise<{ ok: true; datos: T } | { ok: false; mensaje: string }> {
  if (!navigator.onLine) return { ok: false, mensaje: "Para leer fotos hace falta internet." };
  try {
    const foto = await achicarFoto(archivo);
    const r = await fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(foto) });
    const j = await r.json().catch(() => null);
    if (!j?.ok) return { ok: false, mensaje: j?.mensaje ?? "No se pudo leer la foto." };
    return { ok: true, datos: j as T };
  } catch {
    return { ok: false, mensaje: "No se pudo mandar la foto. Revisá la conexión y probá de nuevo." };
  }
}
