import { noAutorizado } from "@/lib/auth";
import { nombreArchivo } from "@/lib/archivos";
import { datosPlanificacion } from "@/lib/planificacion";
import { generarPlanificacionDocx } from "@/docx/planificacion";

export async function GET(_req: Request, ctx: RouteContext<"/api/asignaciones/[id]/planificacion">) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const { id } = await ctx.params;
  const d = await datosPlanificacion(Number(id));
  const archivo = await generarPlanificacionDocx(d);
  const nombre = nombreArchivo(`Planificacion ${d.cab.asig.materia} ${d.cab.curso.anio}${d.cab.div.seccion} ${d.cab.curso.cicloLectivo}`);
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${nombre}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
