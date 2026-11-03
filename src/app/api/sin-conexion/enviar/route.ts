import { revalidatePath } from "next/cache";
import { z } from "zod";
import { noAutorizado } from "@/lib/auth";
import { aplicarAsistencia, aplicarCeldas, itemPendiente } from "@/lib/sin-conexion";

// Recibe lo que se cargó sin señal, en el orden en que se cargó. Cada cambio se informa aparte.
export async function POST(req: Request) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const cuerpo = z.object({ items: z.array(z.unknown()).max(200) }).safeParse(await req.json().catch(() => null));
  if (!cuerpo.success) return Response.json({ error: "Pedido inválido" }, { status: 400 });

  const resultados: { uid: string; ok: boolean; error?: string; aviso?: string }[] = [];
  for (const crudo of cuerpo.data.items) {
    const p = itemPendiente.safeParse(crudo);
    const uid = (crudo as { uid?: unknown })?.uid;
    if (!p.success) {
      resultados.push({ uid: typeof uid === "string" ? uid : "?", ok: false, error: "Datos con un formato que no se entiende" });
      continue;
    }
    const it = p.data;
    try {
      if (it.tipo === "asistencia") {
        await aplicarAsistencia(it);
        resultados.push({ uid: it.uid, ok: true });
      } else {
        const r = await aplicarCeldas(it);
        resultados.push({ uid: it.uid, ok: true, aviso: r.salteadas ? `${r.salteadas} casilleros tenían más de una nota y no se tocaron` : undefined });
      }
      revalidatePath(`/materias/${it.asignacionId}`, "layout");
    } catch (e) {
      resultados.push({ uid: it.uid, ok: false, error: e instanceof Error ? e.message : "Error al guardar" });
    }
  }
  return Response.json({ resultados });
}
