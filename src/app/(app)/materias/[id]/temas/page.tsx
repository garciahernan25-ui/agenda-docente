import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notas } from "@/db/schema";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { cabecera, listaAlumnos, temasDe } from "@/lib/consultas";
import { cuatrimestreDe, hoyAR } from "@/lib/fechas";
import { GrillaTema } from "./grilla";
import { grupoDe } from "@/lib/grupo";

export default function NotasPorTema(props: PageProps<"/materias/[id]/temas">) {
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
  const hoy = hoyAR();
  const c: 1 | 2 = sp.c === "1" ? 1 : sp.c === "2" ? 2 : cuatrimestreDe(hoy);
  const cab = await cabecera(id);
  const [lista, todos] = await Promise.all([listaAlumnos(cab.div.id), temasDe(id)]);
  const temas = todos.filter((t) => t.cuatrimestre === c);
  const pedido = typeof sp.t === "string" ? Number(sp.t) : NaN;
  const tema = temas.find((t) => t.id === pedido) ?? temas.at(-1) ?? null;

  const filasNotas = tema
    ? await db.select().from(notas).where(and(eq(notas.asignacionId, id), eq(notas.temaId, tema.id)))
    : [];

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-4">
      <div className="mx-auto max-w-5xl">
        <Encabezado
          titulo="Notas por tema"
          subtitulo={`${grupoDe(cab)} · ${cab.asig.materia} · ${c}° cuatrimestre`}
          volver={`/materias/${id}?c=${c}`}
        />
        <GrillaTema
          key={`${c}-${tema?.id ?? "nada"}-${filasNotas.map((n) => `${n.id}:${n.valor}`).join(",")}`}
          asignacionId={id}
          cuatrimestre={c}
          hoy={hoy}
          temas={temas.map((t) => ({ id: t.id, titulo: t.titulo }))}
          tema={tema ? { id: tema.id, titulo: tema.titulo } : null}
          alumnos={lista
            .filter(({ insc }) => insc.estado === "activo" || filasNotas.some((n) => n.inscripcionId === insc.id))
            .map(({ insc, alumno }) => ({
              inscripcionId: insc.id,
              orden: insc.orden,
              nombre: `${alumno.apellido}, ${alumno.nombre}`,
              notas: filasNotas
                .filter((n) => n.inscripcionId === insc.id)
                .map((n) => ({ id: n.id, categoria: n.categoria, valor: n.valor, origen: n.origen })),
            }))}
        />
      </div>
    </div>
  );
}
