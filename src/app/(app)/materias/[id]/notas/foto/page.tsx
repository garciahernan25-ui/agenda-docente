import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { cabecera, listaAlumnos, temasDe } from "@/lib/consultas";
import { cuatrimestreDe, hoyAR } from "@/lib/fechas";
import { grupoDe } from "@/lib/grupo";
import { tiposDe } from "@/lib/tipos";
import { NotasDesdeFoto } from "./cliente";

export default function NotasFoto(props: PageProps<"/materias/[id]/notas/foto">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const cab = await cabecera(id);
  const [lista, temas, tipos] = await Promise.all([listaAlumnos(cab.div.id), temasDe(id), tiposDe(id)]);
  const hoy = hoyAR();
  return (
    <>
      <Encabezado titulo="Notas desde una foto" subtitulo={`${grupoDe(cab)} · ${cab.asig.materia}`} volver={`/materias/${id}/notas`} />
      <NotasDesdeFoto
        asignacionId={id}
        hoy={hoy}
        cuatrimestreInicial={cuatrimestreDe(hoy)}
        alumnos={lista
          .filter(({ insc }) => insc.estado === "activo")
          .map(({ insc, alumno }) => ({ id: insc.id, orden: insc.orden, apellido: alumno.apellido, nombre: alumno.nombre }))}
        temas={temas.map((t) => ({ id: t.id, titulo: t.titulo, cuatrimestre: t.cuatrimestre as 1 | 2 }))}
        tipos={tipos.filter((t) => !t.oculta).map((t) => ({ clave: t.clave, nombre: t.nombre }))}
      />
    </>
  );
}
