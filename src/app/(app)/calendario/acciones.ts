"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { eventos, eventosExcepciones, REPETICIONES, TIPOS_EVENTO } from "@/db/schema";
import { exigirDocente } from "@/lib/auth";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const vacioANull = (v: unknown) => (v === "" || v === undefined ? null : v);
const fechaOpc = z.preprocess(vacioANull, fecha.nullable());
const horaOpc = z.preprocess(vacioANull, z.string().regex(/^\d{2}:\d{2}$/).nullable());
const idOpc = z.preprocess(vacioANull, z.coerce.number().int().positive().nullable());

const formEvento = z
  .object({
    titulo: z.string().trim().min(1, "Poné un título"),
    tipo: z.enum(TIPOS_EVENTO),
    fechaInicio: fecha,
    fechaFin: fechaOpc,
    horaInicio: horaOpc,
    horaFin: horaOpc,
    nota: z.preprocess(vacioANull, z.string().trim().nullable()),
    asociado: z.string().default(""), // "a:3" materia, "e:2" escuela, "" nada
    repeticion: z.enum(REPETICIONES).default("ninguna"),
    repetirHasta: fechaOpc,
    avisarDiasAntes: idOpc,
  })
  .refine((e) => !e.fechaFin || e.fechaFin >= e.fechaInicio, { message: "La fecha de fin es anterior al inicio", path: ["fechaFin"] })
  .refine((e) => e.repeticion === "ninguna" || !e.repetirHasta || e.repetirHasta >= e.fechaInicio, {
    message: "“Repetir hasta” es anterior al inicio",
    path: ["repetirHasta"],
  });

export type EstadoForm = { ok?: boolean; error?: string } | null;

export async function crearEvento(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirDocente();
  const r = formEvento.safeParse(Object.fromEntries(form));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Revisá los datos" };
  const { asociado, ...d } = r.data;
  const [tipoAsoc, idAsoc] = asociado.split(":");
  await db.insert(eventos).values({
    ...d,
    fechaFin: d.fechaFin && d.fechaFin !== d.fechaInicio ? d.fechaFin : null,
    repetirHasta: d.repeticion === "ninguna" ? null : d.repetirHasta,
    asignacionId: tipoAsoc === "a" ? Number(idAsoc) : null,
    escuelaId: tipoAsoc === "e" ? Number(idAsoc) : null,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarEvento(id: number) {
  await exigirDocente();
  await db.delete(eventos).where(eq(eventos.id, id));
  revalidatePath("/", "layout");
}

// Saca una sola fecha de una serie que se repite
export async function cancelarOcurrencia(eventoId: number, fechaOriginal: string) {
  await exigirDocente();
  fecha.parse(fechaOriginal);
  await db
    .insert(eventosExcepciones)
    .values({ eventoId, fecha: fechaOriginal, nuevaFecha: null })
    .onConflictDoUpdate({ target: [eventosExcepciones.eventoId, eventosExcepciones.fecha], set: { nuevaFecha: null } });
  revalidatePath("/", "layout");
}
