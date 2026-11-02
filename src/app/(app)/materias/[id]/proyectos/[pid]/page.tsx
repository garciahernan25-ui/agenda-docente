import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { datosProyecto } from "@/lib/proyectos";
import { EditorProyecto } from "./editor";

export default function Proyecto(props: PageProps<"/materias/[id]/proyectos/[pid]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string; pid: string }> }) {
  await exigirDocente();
  const { id, pid } = await params;
  const d = await datosProyecto(Number(pid));
  if (!d || d.p.asignacionId !== Number(id)) notFound();
  const { p, cab, nomina } = d;
  return (
    <>
      <Encabezado titulo={p.titulo} subtitulo={`${cab.curso.anio} ${cab.div.seccion} · ${cab.asig.materia}`} volver={`/materias/${id}/proyectos`} />
      <EditorProyecto
        asignacionId={Number(id)}
        proyecto={{
          id: p.id,
          tipo: p.tipo,
          titulo: p.titulo,
          fecha: p.fecha ?? "",
          horaInicio: p.horaInicio ?? "",
          horaFin: p.horaFin ?? "",
          lugar: p.lugar ?? "",
          conNomina: p.conNomina,
          agendado: !!p.eventoId,
          contenido: p.contenido,
        }}
        cantidadAlumnos={nomina.length}
      />
    </>
  );
}
