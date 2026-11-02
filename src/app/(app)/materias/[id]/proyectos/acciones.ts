"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { asignaciones, cursos, divisiones, eventos, proyectos, TIPOS_PROYECTO } from "@/db/schema";
import { exigirDocente } from "@/lib/auth";
import { plantillaProyecto } from "@/lib/proyectos-textos";

const largo = z.string().max(20000).optional();
const vacioANull = (v: unknown) => (v === "" || v === undefined ? null : v);

export async function crearProyecto(form: FormData) {
  await exigirDocente();
  const d = z
    .object({ asignacionId: z.coerce.number().int().positive(), tipo: z.enum(TIPOS_PROYECTO), titulo: z.string().trim().min(1).max(200) })
    .parse(Object.fromEntries(form));
  const [asig] = await db.select().from(asignaciones).where(eq(asignaciones.id, d.asignacionId));
  if (!asig) throw new Error("No existe esa materia");
  const [p] = await db
    .insert(proyectos)
    .values({ asignacionId: d.asignacionId, tipo: d.tipo, titulo: d.titulo, contenido: plantillaProyecto(d.tipo, asig.profesor) })
    .returning();
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  redirect(`/materias/${d.asignacionId}/proyectos/${p.id}`);
}

const entrada = z.object({
  id: z.number().int().positive(),
  asignacionId: z.number().int().positive(),
  tipo: z.enum(TIPOS_PROYECTO),
  titulo: z.string().trim().min(1, "Poné un título").max(200),
  fecha: z.preprocess(vacioANull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  horaInicio: z.preprocess(vacioANull, z.string().regex(/^\d{2}:\d{2}$/).nullable()),
  horaFin: z.preprocess(vacioANull, z.string().regex(/^\d{2}:\d{2}$/).nullable()),
  lugar: z.preprocess(vacioANull, z.string().trim().max(300).nullable()),
  conNomina: z.boolean(),
  agendar: z.boolean(),
  contenido: z.object({
    responsables: largo,
    fundamentacion: largo,
    objetivos: largo,
    contenidos: largo,
    antes: largo,
    durante: largo,
    despues: largo,
    recursos: largo,
    logistica: largo,
    evaluacion: largo,
    observaciones: largo,
  }),
});

export async function guardarProyecto(datos: z.input<typeof entrada>) {
  await exigirDocente();
  const d = entrada.parse(datos);
  const [actual] = await db
    .select()
    .from(proyectos)
    .where(and(eq(proyectos.id, d.id), eq(proyectos.asignacionId, d.asignacionId)));
  if (!actual) throw new Error("No existe ese proyecto");

  // Evento en el calendario: se crea, se actualiza o se saca según lo que elijas
  let eventoId = actual.eventoId;
  const [eventoActual] = eventoId ? await db.select({ id: eventos.id }).from(eventos).where(eq(eventos.id, eventoId)) : [];
  if (!eventoActual) eventoId = null;

  if (d.agendar && d.fecha) {
    const [esc] = await db
      .select({ escuelaId: cursos.escuelaId })
      .from(asignaciones)
      .innerJoin(divisiones, eq(asignaciones.divisionId, divisiones.id))
      .innerJoin(cursos, eq(divisiones.cursoId, cursos.id))
      .where(eq(asignaciones.id, d.asignacionId));
    const valores = {
      titulo: d.titulo,
      tipo: d.tipo === "salida" ? ("salida" as const) : ("otro" as const),
      fechaInicio: d.fecha,
      horaInicio: d.horaInicio,
      horaFin: d.horaFin,
      nota: d.lugar,
      asignacionId: d.asignacionId,
      escuelaId: esc?.escuelaId ?? null,
    };
    if (eventoId) await db.update(eventos).set(valores).where(eq(eventos.id, eventoId));
    else eventoId = (await db.insert(eventos).values(valores).returning({ id: eventos.id }))[0].id;
  } else if (eventoId) {
    await db.delete(eventos).where(eq(eventos.id, eventoId));
    eventoId = null;
  }

  await db
    .update(proyectos)
    .set({
      tipo: d.tipo,
      titulo: d.titulo,
      fecha: d.fecha,
      horaInicio: d.horaInicio,
      horaFin: d.horaFin,
      lugar: d.lugar,
      conNomina: d.conNomina,
      contenido: d.contenido,
      eventoId,
    })
    .where(eq(proyectos.id, d.id));
  revalidatePath("/", "layout");
  return { ok: true as const, agendado: !!eventoId };
}

export async function borrarProyecto(form: FormData) {
  await exigirDocente();
  const { id, asignacionId } = z
    .object({ id: z.coerce.number().int().positive(), asignacionId: z.coerce.number().int().positive() })
    .parse(Object.fromEntries(form));
  const [p] = await db.select().from(proyectos).where(and(eq(proyectos.id, id), eq(proyectos.asignacionId, asignacionId)));
  if (p) {
    await db.delete(proyectos).where(eq(proyectos.id, id));
    if (p.eventoId) await db.delete(eventos).where(eq(eventos.id, p.eventoId));
  }
  revalidatePath("/", "layout");
  redirect(`/materias/${asignacionId}/proyectos`);
}
