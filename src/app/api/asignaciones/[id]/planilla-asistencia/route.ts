import type { NextRequest } from "next/server";
import { noAutorizado } from "@/lib/auth";
import { datosPlanillaAsistencia } from "@/lib/planillas";
import { generarPlanillaAsistencia } from "@/pdf/planilla-asistencia";
import { nombreArchivo } from "@/lib/archivos";

// /api/asignaciones/1/planilla-asistencia?cuatrimestre=2
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/asignaciones/[id]/planilla-asistencia">,
) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const { id } = await ctx.params;
  const cuatrimestre = req.nextUrl.searchParams.get("cuatrimestre") === "2" ? 2 : 1;
  const datos = await datosPlanillaAsistencia(Number(id), cuatrimestre);
  const pdf = await generarPlanillaAsistencia(datos);
  const nombre = nombreArchivo(`Asistencia ${datos.materia} ${datos.curso} ${cuatrimestre}C`);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("ver") ? "inline" : "attachment"}; filename="${nombre}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
