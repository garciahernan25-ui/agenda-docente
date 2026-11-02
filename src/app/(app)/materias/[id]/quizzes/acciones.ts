"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirDocente } from "@/lib/auth";
import { hoyAR } from "@/lib/fechas";
import { aplicarCambios, leerQuizzes, planQuizzes, vincular } from "@/lib/quizzes";

const entradaVinculos = z.object({
  asignacionId: z.number().int().positive(),
  pares: z.array(z.object({ inscripcionId: z.number().int().positive(), quizAlumnoId: z.string().min(1).max(100).nullable() })).max(200),
});

export async function guardarVinculos(datos: z.input<typeof entradaVinculos>) {
  await exigirDocente();
  const d = entradaVinculos.parse(datos);
  await vincular(d.asignacionId, d.pares);
  revalidatePath(`/materias/${d.asignacionId}`, "layout");
  return { ok: true as const };
}

// Vuelve a leer los quizzes en el momento (no confía en lo que mostró la pantalla) y carga las notas
export async function traerNotas(asignacionId: number) {
  await exigirDocente();
  const id = z.number().int().positive().parse(asignacionId);
  const lectura = await leerQuizzes();
  if (!lectura.ok) return { ok: false as const, motivo: lectura.motivo };
  const plan = await planQuizzes(id, lectura.datos);
  await aplicarCambios(id, plan.cambios, hoyAR());
  revalidatePath(`/materias/${id}`, "layout");
  return {
    ok: true as const,
    nuevas: plan.cambios.filter((c) => !c.existenteId).length,
    actualizadas: plan.cambios.filter((c) => c.existenteId).length,
  };
}
