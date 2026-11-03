import { Suspense } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notas, CATEGORIAS, type Categoria } from "@/db/schema";
import { Cargando, Encabezado, Vacio } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { cabecera, listaAlumnos, temasDe } from "@/lib/consultas";
import { NOMBRE_CATEGORIA } from "@/lib/textos";
import { EditorTanda } from "./editor";
import { grupoDe } from "@/lib/grupo";

export default function Tanda(props: PageProps<"/materias/[id]/notas/tanda">) {
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
  const c: 1 | 2 = sp.c === "2" ? 2 : 1;
  const fecha = typeof sp.f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.f) ? sp.f : null;
  const categoria = CATEGORIAS.includes(sp.cat as Categoria) ? (sp.cat as Categoria) : null;
  const temaId = typeof sp.t === "string" && /^\d+$/.test(sp.t) ? Number(sp.t) : null;
  const volver = `/materias/${id}/notas?c=${c}`;

  const cab = await cabecera(id);
  if (!fecha || !categoria) {
    return (
      <>
        <Encabezado titulo="Corregir notas" volver={volver} />
        <Vacio>No encontré esa tanda de notas.</Vacio>
      </>
    );
  }
  const [lista, temas, filas] = await Promise.all([
    listaAlumnos(cab.div.id),
    temasDe(id),
    db
      .select()
      .from(notas)
      .where(
        and(
          eq(notas.asignacionId, id),
          eq(notas.cuatrimestre, c),
          eq(notas.fecha, fecha),
          eq(notas.categoria, categoria),
          temaId === null ? isNull(notas.temaId) : eq(notas.temaId, temaId),
        ),
      ),
  ]);

  return (
    <>
      <Encabezado
        titulo="Corregir notas"
        subtitulo={`${grupoDe(cab)} · ${NOMBRE_CATEGORIA[categoria]} · ${c}° cuatrimestre`}
        volver={volver}
      />
      <EditorTanda
        key={`${fecha}${categoria}${temaId}`}
        asignacionId={id}
        cuatrimestre={c}
        volver={volver}
        fecha={fecha}
        categoria={categoria}
        temaId={temaId}
        temas={temas.filter((t) => t.cuatrimestre === c).map((t) => ({ id: t.id, titulo: t.titulo }))}
        alumnos={lista
          .filter(({ insc }) => insc.estado === "activo" || filas.some((n) => n.inscripcionId === insc.id))
          .map(({ insc, alumno }) => ({
            inscripcionId: insc.id,
            orden: insc.orden,
            nombre: `${alumno.apellido}, ${alumno.nombre}`,
            notas: filas.filter((n) => n.inscripcionId === insc.id).map((n) => ({ id: n.id, valor: n.valor })),
          }))}
      />
    </>
  );
}
