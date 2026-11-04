import { noAutorizado } from "@/lib/auth";
import { leerPlanilla, pedidoFoto } from "@/lib/foto-lectura";
import { MENSAJE_LECTURA } from "@/lib/gemini";

// Lee una foto de una planilla de notas y devuelve filas y columnas para revisar (no guarda nada)
export async function POST(req: Request) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const p = pedidoFoto.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ ok: false, mensaje: "La foto no llegó bien. Probá de nuevo." }, { status: 400 });
  const r = await leerPlanilla(p.data.imagen, p.data.mime);
  if (!r.ok) return Response.json({ ok: false, mensaje: MENSAJE_LECTURA[r.motivo], detalle: "detalle" in r ? r.detalle : undefined });
  return Response.json({ ok: true, planilla: r.datos });
}
