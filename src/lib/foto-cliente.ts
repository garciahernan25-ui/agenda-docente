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

// Un PDF va tal cual (no se puede achicar como una foto); tiene que pesar menos de 3 MB
async function pdfABase64(archivo: File): Promise<{ imagen: string; mime: "application/pdf" }> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { imagen: btoa(bin), mime: "application/pdf" };
}

export const ACEPTA = "image/*,application/pdf";

export async function mandarFoto<T>(ruta: string, archivo: File): Promise<{ ok: true; datos: T } | { ok: false; mensaje: string }> {
  if (!navigator.onLine) return { ok: false, mensaje: "Para leer fotos hace falta internet." };
  const esPdf = archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name);
  if (esPdf && archivo.size > 3 * 1024 * 1024) return { ok: false, mensaje: "El PDF pesa más de 3 MB. Probá con una foto o un PDF más liviano." };
  if (!esPdf && !archivo.type.startsWith("image/")) return { ok: false, mensaje: "Tiene que ser una foto, una imagen o un PDF." };
  try {
    const foto = esPdf ? await pdfABase64(archivo) : await achicarFoto(archivo);
    const r = await fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(foto) });
    const j = await r.json().catch(() => null);
    if (!j?.ok) return { ok: false, mensaje: j?.mensaje ?? "No se pudo leer la foto." };
    return { ok: true, datos: j as T };
  } catch {
    return { ok: false, mensaje: "No se pudo mandar la foto. Revisá la conexión y probá de nuevo." };
  }
}
