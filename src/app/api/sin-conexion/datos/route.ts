import { noAutorizado } from "@/lib/auth";
import { datosParaSinConexion } from "@/lib/sin-conexion";

// Lo que el celu guarda para poder tomar asistencia y cargar notas sin señal
export async function GET() {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  return Response.json({ ...(await datosParaSinConexion()), generado: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
