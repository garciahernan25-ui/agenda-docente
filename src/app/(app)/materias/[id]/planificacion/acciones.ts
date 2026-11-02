"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { asignaciones, planificaciones, temas, unidades } from "@/db/schema";
import { exigirDocente } from "@/lib/auth";

const textoLargo = z.string().max(20000).optional();

const entrada = z.object({
  asignacionId: z.number().int().positive(),
  contenido: z.object({
    cargaHoraria: textoLargo,
    fundamentacion: textoLargo,
    objetivosEnsenanza: textoLargo,
    objetivosAprendizaje: textoLargo,
    estrategias: textoLargo,
    recursos: textoLargo,
    sistemaEvaluativo: textoLargo,
    criterios: textoLargo,
    bibliografiaDocente: textoLargo,
    bibliografiaEstudiante: textoLargo,
    proyectos: textoLargo,
    observaciones: textoLargo,
    fechaEntrega: textoLargo,
  }),
  unidades: z
    .array(
      z.object({
        cuatrimestre: z.union([z.literal(1), z.literal(2)]),
        titulo: z.string().trim().max(200),
        eje: z.string().trim().max(300),
        contenidos: z.string().max(20000),
      }),
    )
    .max(30),
});

export async function guardarPlanificacion(datos: z.input<typeof entrada>) {
  await exigirDocente();
  const d = entrada.parse(datos);
  const [asig] = await db.select({ id: asignaciones.id }).from(asignaciones).where(eq(asignaciones.id, d.asignacionId));
  if (!asig) throw new Error("No existe esa materia");

  const ahora = new Date().toISOString();
  const lista = d.unidades.filter((u) => u.titulo || u.contenidos.trim());
  // Primero las del 1° cuatrimestre, después las del 2°, respetando el orden en que las cargaste
  const ordenadas = [...lista.filter((u) => u.cuatrimestre === 1), ...lista.filter((u) => u.cuatrimestre === 2)];

  await db.batch([
    db
      .insert(planificaciones)
      .values({ asignacionId: d.asignacionId, contenido: d.contenido, actualizadoEn: ahora })
      .onConflictDoUpdate({ target: planificaciones.asignacionId, set: { contenido: d.contenido, actualizadoEn: ahora } }),
    db.delete(unidades).where(eq(unidades.asignacionId, d.asignacionId)),
    ...ordenadas.map((u, i) =>
      db.insert(unidades).values({
        asignacionId: d.asignacionId,
        cuatrimestre: u.cuatrimestre,
        orden: i,
        titulo: u.titulo || `Unidad ${i + 1}`,
        eje: u.eje || null,
        contenidos: u.contenidos,
      }),
    ),
  ]);
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const };
}

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Un tema por unidad (con el nombre de la unidad) en su cuatrimestre, salvo los que ya existan
export async function crearTemasDesdeUnidades(asignacionId: number) {
  await exigirDocente();
  const [uni, existentes] = await Promise.all([
    db.select().from(unidades).where(eq(unidades.asignacionId, asignacionId)).orderBy(asc(unidades.orden)),
    db.select().from(temas).where(eq(temas.asignacionId, asignacionId)),
  ]);
  const ya = new Set(existentes.map((t) => `${t.cuatrimestre}|${normal(t.titulo)}`));
  const base = Date.now() % 1e9;
  let creados = 0;
  for (const u of uni) {
    const clave = `${u.cuatrimestre}|${normal(u.titulo)}`;
    if (ya.has(clave)) continue;
    ya.add(clave);
    await db.insert(temas).values({ asignacionId, cuatrimestre: u.cuatrimestre, titulo: u.titulo.slice(0, 120), orden: base + u.orden });
    creados++;
  }
  revalidatePath(`/materias/${asignacionId}`, "layout");
  return { creados, yaEstaban: uni.length - creados };
}

// Trae la planificación de otra materia (por ejemplo, el mismo espacio en otra escuela)
export async function copiarPlanificacion(desde: number, hacia: number) {
  await exigirDocente();
  const [[plan], uni] = await Promise.all([
    db.select().from(planificaciones).where(eq(planificaciones.asignacionId, desde)),
    db.select().from(unidades).where(eq(unidades.asignacionId, desde)).orderBy(asc(unidades.orden)),
  ]);
  if (!plan && !uni.length) return { ok: false as const };
  return guardarPlanificacion({
    asignacionId: hacia,
    contenido: plan?.contenido ?? {},
    unidades: uni.map((u) => ({
      cuatrimestre: u.cuatrimestre === 2 ? 2 : 1,
      titulo: u.titulo,
      eje: u.eje ?? "",
      contenidos: u.contenidos,
    })),
  });
}
