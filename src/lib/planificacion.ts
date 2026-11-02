// Planificación anual de una materia: los textos del modelo + las unidades por cuatrimestre
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { planificaciones, unidades, type PlanificacionAnual } from "@/db/schema";
import { cabecera } from "./planillas";

export type UnidadPlan = { cuatrimestre: 1 | 2; titulo: string; eje: string; contenidos: string };

export async function datosPlanificacion(asignacionId: number) {
  const [cab, [plan], uni] = await Promise.all([
    cabecera(asignacionId),
    db.select().from(planificaciones).where(eq(planificaciones.asignacionId, asignacionId)),
    db.select().from(unidades).where(eq(unidades.asignacionId, asignacionId)).orderBy(asc(unidades.cuatrimestre), asc(unidades.orden)),
  ]);
  return {
    cab,
    contenido: (plan?.contenido ?? {}) as PlanificacionAnual,
    unidades: uni.map<UnidadPlan>((u) => ({
      cuatrimestre: u.cuatrimestre === 2 ? 2 : 1,
      titulo: u.titulo,
      eje: u.eje ?? "",
      contenidos: u.contenidos,
    })),
    actualizada: plan?.actualizadoEn ?? null,
  };
}

export type DatosPlanificacion = Awaited<ReturnType<typeof datosPlanificacion>>;

// Cada renglón no vacío es una viñeta; saca viñetas pegadas desde Word ("●", "-", "•")
export function renglones(texto: string | undefined): string[] {
  return (texto ?? "")
    .split(/\r?\n/)
    .map((r) => r.replace(/^\s*[●•\-–*]\s*/, "").trim())
    .filter(Boolean);
}

// Números de unidad seguidos en todo el año (1° y 2° cuatrimestre)
export function numerarUnidades<T extends { cuatrimestre: number }>(lista: T[]) {
  return lista.map((u, i) => ({ ...u, numero: i + 1 }));
}
