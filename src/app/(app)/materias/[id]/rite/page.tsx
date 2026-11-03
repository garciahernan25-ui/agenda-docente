import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { datosRite } from "@/lib/eps";
import { EditorRite } from "./editor";
import { grupoDe } from "@/lib/grupo";

export default function Rite(props: PageProps<"/materias/[id]/rite">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const { cab, filas, nivel } = await datosRite(id);
  const e = cab.asig.datosEps ?? {};
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-4">
      <div className="mx-auto max-w-[1400px]">
        <Encabezado
          titulo={`RITE ${cab.curso.cicloLectivo} · ${e.area || cab.asig.materia}`}
          subtitulo={`${grupoDe(cab)} · ${cab.escuela.nombre}`}
          volver={`/materias/${id}`}
        />
        <EditorRite
          asignacionId={id}
          ciclo={cab.curso.cicloLectivo}
          encabezado={{
            distrito: cab.escuela.distrito ?? "",
            region: e.region ?? "",
            familiaProfesional: e.familiaProfesional ?? "",
            nivel,
            area: e.area || cab.asig.materia,
            docente: cab.asig.profesor,
            correo: e.correo ?? "",
          }}
          contextual={{
            capacidades: cab.asig.informeContextual?.capacidades ?? "",
            actividades: cab.asig.informeContextual?.actividades ?? "",
            dificultades: cab.asig.informeContextual?.dificultades ?? "",
            observaciones: cab.asig.informeContextual?.observaciones ?? "",
          }}
          filas={filas}
        />
      </div>
    </div>
  );
}
