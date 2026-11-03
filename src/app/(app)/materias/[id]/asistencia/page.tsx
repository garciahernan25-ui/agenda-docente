import { Suspense } from "react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, clases } from "@/db/schema";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { cabecera, eventosEnRango, listaAlumnos, temasDe } from "@/lib/consultas";
import { esDiaSinClases } from "@/lib/calendario";
import { cuatrimestreDe, hoyAR } from "@/lib/fechas";
import { TomarAsistencia } from "./tomar";
import { grupoDe } from "@/lib/grupo";

export default function Asistencia(props: PageProps<"/materias/[id]/asistencia">) {
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
  const fecha = typeof sp.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyAR();

  const cab = await cabecera(id);
  const [lista, [clase], recientes, eventosDia, temas] = await Promise.all([
    listaAlumnos(cab.div.id),
    db.select().from(clases).where(and(eq(clases.asignacionId, id), eq(clases.fecha, fecha))),
    db.select().from(clases).where(eq(clases.asignacionId, id)).orderBy(desc(clases.fecha)).limit(8),
    eventosEnRango(fecha, fecha),
    temasDe(id),
  ]);
  const registros = clase ? await db.select().from(asistencias).where(inArray(asistencias.claseId, [clase.id])) : [];
  const estados = Object.fromEntries(registros.map((r) => [r.inscripcionId, r.estado]));
  const cuatri = cuatrimestreDe(fecha);

  return (
    <>
      <Encabezado
        titulo="Asistencia"
        subtitulo={`${grupoDe(cab)} · ${cab.asig.materia}`}
        volver={`/materias/${id}`}
      />
      <TomarAsistencia
        key={fecha}
        asignacionId={id}
        fecha={fecha}
        hoy={hoyAR()}
        yaCargada={!!clase}
        dictadaInicial={clase ? clase.dictada : !esDiaSinClases(fecha, eventosDia)}
        avisoSinClases={eventosDia.find((e) => e.tipo === "sin_clases")?.titulo ?? null}
        temaInicial={clase?.temaId ?? null}
        temas={temas.filter((t) => t.cuatrimestre === cuatri).map((t) => ({ id: t.id, titulo: t.titulo }))}
        alumnos={lista.map(({ insc, alumno }) => ({
          inscripcionId: insc.id,
          orden: insc.orden,
          nombre: `${alumno.apellido}, ${alumno.nombre}`,
          baja: insc.estado === "baja",
          estado: estados[insc.id] ?? null,
        }))}
        recientes={recientes.map((c) => ({ fecha: c.fecha, dictada: c.dictada }))}
      />
    </>
  );
}
