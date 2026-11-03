import { Suspense } from "react";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { notas } from "@/db/schema";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { sugerirValoracion } from "@/lib/calculos";
import { resumenMateria } from "@/lib/consultas";
import { cuatrimestreDe, hoyAR } from "@/lib/fechas";
import { EditorCierre } from "./editor";
import { grupoDe } from "@/lib/grupo";

export default function Cierre(props: PageProps<"/materias/[id]/cierre">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Contenido({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirDocente();
  const id = Number((await params).id);
  const sp = await searchParams;
  const c: 1 | 2 = sp.c === "1" ? 1 : sp.c === "2" ? 2 : cuatrimestreDe(hoyAR());
  const { cab, filas, pesos } = await resumenMateria(id, c);

  // Valoración preliminar: notas de los dos primeros meses del cuatrimestre (mar–abr / ago–sep)
  const corte = `${cab.curso.cicloLectivo}-${c === 1 ? "05" : "10"}-01`;
  const tempranas = await db
    .select()
    .from(notas)
    .where(and(eq(notas.asignacionId, id), eq(notas.cuatrimestre, c), lt(notas.fecha, corte)));

  return (
    <>
      <Encabezado
        titulo={`Cierre del ${c}° cuatrimestre`}
        subtitulo={`${grupoDe(cab)} · ${cab.asig.materia}`}
        volver={`/materias/${id}?c=${c}`}
      />
      <EditorCierre
        asignacionId={id}
        cuatrimestre={c}
        filas={filas
          .filter((f) => !f.baja)
          .map((f) => ({
            inscripcionId: f.inscripcionId,
            orden: f.orden,
            nombre: f.nombre,
            calculada: f.calculada,
            cantidadNotas: f.cantidadNotas,
            sugerida: sugerirValoracion(
              tempranas.filter((n) => n.inscripcionId === f.inscripcionId),
              pesos,
            ),
            inasistencias: f.asistencia.clases ? f.asistencia.inasistencias : null,
            cierre: {
              valoracion1: f.cierre?.valoracion1 ?? null,
              calificacion1: f.cierre?.calificacion1 ?? null,
              valoracion2: f.cierre?.valoracion2 ?? null,
              calificacion2: f.cierre?.calificacion2 ?? null,
              intensificacion1: f.cierre?.intensificacion1 ?? null,
              diciembre: f.cierre?.diciembre ?? null,
              febrero: f.cierre?.febrero ?? null,
              calificacionFinal: f.cierre?.calificacionFinal ?? null,
            },
          }))}
      />
    </>
  );
}
