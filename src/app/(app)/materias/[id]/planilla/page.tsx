import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { filasPlanilla } from "@/lib/planillas";
import { EditorPlanilla } from "./editor";
import { grupoDe } from "@/lib/grupo";

export default function Planilla(props: PageProps<"/materias/[id]/planilla">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const { cab, filas, clases } = await filasPlanilla(id);
  // Esta pantalla usa todo el ancho en la compu (la planilla es ancha); en el celu es igual que las demás
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-4">
      <div className="mx-auto max-w-[1400px]">
      <Encabezado
        titulo="Planilla de notas"
        subtitulo={`${grupoDe(cab)} · ${cab.asig.materia} · ${cab.escuela.nombre} · ${cab.curso.cicloLectivo}`}
        volver={`/materias/${id}`}
      />
      <EditorPlanilla asignacionId={id} filas={filas} clases={clases} />
      </div>
    </div>
  );
}
