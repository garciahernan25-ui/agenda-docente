import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { datosPlanFormativo } from "@/lib/eps";
import { EditorPlan } from "./editor";
import { grupoDe } from "@/lib/grupo";

export default function Plan(props: PageProps<"/materias/[id]/plan">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const { cab, estudiantes } = await datosPlanFormativo(id);
  const e = cab.asig.datosEps ?? {};
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-4">
      <div className="mx-auto max-w-[1100px]">
        <Encabezado
          titulo="Plan de trabajo formativo"
          subtitulo={`${grupoDe(cab)} · ${cab.escuela.nombre}`}
          volver={`/materias/${id}`}
        />
        <EditorPlan
          asignacionId={id}
          encabezado={{
            oferta: e.oferta ?? "",
            region: e.region ?? "",
            sede: e.sede || cab.escuela.nombre,
            cfp: e.cfp ?? "",
            turno: cab.div.turno,
          }}
          estudiantes={estudiantes}
        />
      </div>
    </div>
  );
}
