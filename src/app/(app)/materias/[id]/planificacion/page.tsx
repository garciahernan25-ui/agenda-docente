import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { listarMaterias } from "@/lib/consultas";
import { datosPlanificacion } from "@/lib/planificacion";
import { EditorPlanificacion } from "./editor";
import { grupoDe, nombreGrupo } from "@/lib/grupo";

export default function Planificacion(props: PageProps<"/materias/[id]/planificacion">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const [{ cab, contenido, unidades }, materias] = await Promise.all([datosPlanificacion(id), listarMaterias()]);
  const eps = cab.modalidad.formato === "eps";
  return (
    <>
      <Encabezado
        titulo="Planificación anual"
        subtitulo={`${grupoDe(cab)} · ${cab.asig.materia} · ${cab.curso.cicloLectivo}`}
        volver={`/materias/${id}`}
      />
      <EditorPlanificacion
        asignacionId={id}
        datos={{
          escuela: cab.escuela.nombre,
          docente: cab.asig.profesor,
          curso: `${grupoDe(cab)}`,
          turno: cab.div.turno,
          materia: cab.asig.materia,
          ciclo: cab.curso.cicloLectivo,
        }}
        contenido={contenido}
        unidades={unidades}
        otras={materias
          .filter((m) => m.id !== id)
          .map((m) => ({ id: m.id, texto: `${nombreGrupo(m.formato, m.anio, m.seccion)} · ${m.materia} · ${m.escuela}` }))}
      />
    </>
  );
}
