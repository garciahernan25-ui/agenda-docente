import type { NextRequest } from "next/server";
import { noAutorizado } from "@/lib/auth";
import { datosPlanillaCalificaciones } from "@/lib/planillas";
import { generarPlanillaCalificaciones } from "@/pdf/planilla-calificaciones";
import { plantillaCalificaciones } from "@/pdf/plantilla";
import { nombreArchivo } from "@/lib/archivos";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/asignaciones/[id]/planilla-calificaciones">,
) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const { id } = await ctx.params;
  const datos = await datosPlanillaCalificaciones(Number(id));
  const pdf = await generarPlanillaCalificaciones(await plantillaCalificaciones(), datos);
  const nombre = nombreArchivo(
    `Calificaciones ${datos.materia} ${datos.anio}${datos.seccion} ${datos.cicloLectivo}`,
  );
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // ?ver=1 lo abre en el navegador (para mirar o imprimir); sin eso, se descarga
      "Content-Disposition": `${req.nextUrl.searchParams.get("ver") ? "inline" : "attachment"}; filename="${nombre}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
