// Tipos de evaluación de una materia, leídos de la base
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pesos } from "@/db/schema";
import { armarTipos } from "./tipos-comun";

export async function tiposDe(asignacionId: number) {
  return armarTipos(await db.select().from(pesos).where(eq(pesos.asignacionId, asignacionId)));
}

// Para validar lo que llega: cualquier tipo de la materia (incluso los sacados, que pueden tener notas viejas)
export async function validarCategorias(asignacionId: number, categorias: string[]) {
  if (!categorias.length) return;
  const validas = new Set((await tiposDe(asignacionId)).map((t) => t.clave));
  const mal = categorias.find((c) => !validas.has(c));
  if (mal) throw new Error(`"${mal}" no es un tipo de evaluación de esta materia`);
}
