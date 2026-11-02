// Datos de un proyecto (salida educativa, laboratorio u otro) con su cabecera y la nómina del curso
import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { proyectos } from "@/db/schema";
import { cabecera, listaAlumnos } from "./planillas";

export async function proyectosDe(asignacionId: number) {
  return db.select().from(proyectos).where(eq(proyectos.asignacionId, asignacionId)).orderBy(desc(proyectos.fecha), desc(proyectos.id));
}

export async function datosProyecto(proyectoId: number) {
  const [p] = await db.select().from(proyectos).where(eq(proyectos.id, proyectoId));
  if (!p) return null;
  const cab = await cabecera(p.asignacionId);
  const lista = await listaAlumnos(cab.div.id);
  const nomina = lista
    .filter(({ insc }) => insc.estado === "activo")
    .map(({ alumno }, i) => ({ n: i + 1, apellidoNombre: `${alumno.apellido}, ${alumno.nombre}` }));
  return { p, cab, nomina };
}

export type DatosProyecto = NonNullable<Awaited<ReturnType<typeof datosProyecto>>>;
