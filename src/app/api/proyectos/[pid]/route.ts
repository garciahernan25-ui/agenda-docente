import { noAutorizado } from "@/lib/auth";
import { nombreArchivo } from "@/lib/archivos";
import { datosProyecto } from "@/lib/proyectos";
import { armarProyecto } from "@/lib/proyectos-formato";
import { generarProyectoDocx } from "@/docx/proyecto";

export async function GET(_req: Request, ctx: RouteContext<"/api/proyectos/[pid]">) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const { pid } = await ctx.params;
  const d = await datosProyecto(Number(pid));
  if (!d) return new Response("No existe ese proyecto", { status: 404 });
  const archivo = await generarProyectoDocx(armarProyecto(d), d.cab.asig.profesor);
  const nombre = nombreArchivo(`Proyecto ${d.p.titulo} ${d.cab.curso.anio}${d.cab.div.seccion}`);
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${nombre}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
