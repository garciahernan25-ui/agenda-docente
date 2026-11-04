import { noAutorizado } from "@/lib/auth";
import { leerPlanillaOficial, pedidoFoto } from "@/lib/foto-lectura";
import { MENSAJE_LECTURA } from "@/lib/gemini";

// Lee la planilla oficial de calificaciones (foto o PDF) y devuelve las filas para revisar (no guarda nada)
export async function POST(req: Request) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const p = pedidoFoto.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ ok: false, mensaje: "El archivo no llegó bien. Probá de nuevo." }, { status: 400 });
  const r = await leerPlanillaOficial(p.data.imagen, p.data.mime);
  if (!r.ok) return Response.json({ ok: false, mensaje: MENSAJE_LECTURA[r.motivo], detalle: "detalle" in r ? r.detalle : undefined });
  return Response.json({ ok: true, filas: r.datos });
}
