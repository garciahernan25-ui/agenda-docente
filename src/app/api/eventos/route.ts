import type { NextRequest } from "next/server";
import { noAutorizado } from "@/lib/auth";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { eventos, eventosExcepciones, REPETICIONES, TIPOS_EVENTO } from "@/db/schema";
import { ocurrencias, sumarDias } from "@/lib/calendario";
import { hoyAR } from "@/lib/fechas";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha YYYY-MM-DD");
const hora = z.string().regex(/^\d{2}:\d{2}$/, "Hora HH:MM");

// GET /api/eventos?desde=2026-11-01&hasta=2026-11-30
// Sin parámetros: lo que viene en los próximos 30 días
export async function GET(req: NextRequest) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const hoy = hoyAR();
  const q = req.nextUrl.searchParams;
  const rango = z.object({ desde: fecha, hasta: fecha }).safeParse({
    desde: q.get("desde") ?? hoy,
    hasta: q.get("hasta") ?? sumarDias(hoy, 30),
  });
  if (!rango.success) return Response.json({ error: rango.error.issues }, { status: 400 });

  const evs = await db.select().from(eventos);
  const exc = evs.length
    ? await db.select().from(eventosExcepciones).where(inArray(eventosExcepciones.eventoId, evs.map((e) => e.id)))
    : [];
  return Response.json(ocurrencias(evs, rango.data.desde, rango.data.hasta, exc));
}

const nuevoEvento = z
  .object({
    titulo: z.string().trim().min(1),
    tipo: z.enum(TIPOS_EVENTO).default("otro"),
    fechaInicio: fecha,
    fechaFin: fecha.nullish(),
    horaInicio: hora.nullish(),
    horaFin: hora.nullish(),
    nota: z.string().nullish(),
    asignacionId: z.number().int().nullish(),
    escuelaId: z.number().int().nullish(),
    repeticion: z.enum(REPETICIONES).default("ninguna"),
    repetirHasta: fecha.nullish(),
    avisarDiasAntes: z.number().int().min(0).max(60).nullish(),
  })
  .refine((e) => !e.fechaFin || e.fechaFin >= e.fechaInicio, "La fecha de fin es anterior al inicio")
  .refine((e) => !e.repetirHasta || e.repetirHasta >= e.fechaInicio, "Repetir hasta es anterior al inicio");

// POST /api/eventos  { titulo, tipo, fechaInicio, repeticion: "semanal", repetirHasta: "2026-12-15", ... }
export async function POST(req: NextRequest) {
  const sinPermiso = await noAutorizado();
  if (sinPermiso) return sinPermiso;
  const datos = nuevoEvento.safeParse(await req.json().catch(() => null));
  if (!datos.success) return Response.json({ error: datos.error.issues }, { status: 400 });
  const [creado] = await db.insert(eventos).values(datos.data).returning();
  return Response.json(creado, { status: 201 });
}
