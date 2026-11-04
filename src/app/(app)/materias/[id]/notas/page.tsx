import Link from "next/link";
import { Suspense } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notas } from "@/db/schema";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { cabecera, listaAlumnos, temasDe } from "@/lib/consultas";
import { cuatrimestreDe, fechaCortaMayus, hoyAR } from "@/lib/fechas";
import { tiposDe } from "@/lib/tipos";
import { nombresDeTipos } from "@/lib/tipos-comun";
import { CargarNotas } from "./cargar";
import { grupoDe } from "@/lib/grupo";

export default function Notas(props: PageProps<"/materias/[id]/notas">) {
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
  const [lista, temas, recientes, tipos] = await Promise.all([
    listaAlumnos(cab.div.id),
    temasDe(id),
    db
      .select()
      .from(notas)
      .where(and(eq(notas.asignacionId, id), eq(notas.cuatrimestre, c)))
      .orderBy(desc(notas.fecha), desc(notas.id))
      .limit(400),
    tiposDe(id),
  ]);
  const nombreTipo = nombresDeTipos(tipos);

  // Agrupa lo ya cargado: misma fecha, categoría y tema = una "tanda"
  const tandas = new Map<string, { fecha: string; categoria: string; temaId: number | null; cantidad: number }>();
  for (const n of recientes) {
    const k = `${n.fecha}|${n.categoria}|${n.temaId}`;
    const t = tandas.get(k) ?? { fecha: n.fecha, categoria: n.categoria, temaId: n.temaId, cantidad: 0 };
    t.cantidad++;
    tandas.set(k, t);
  }
  const tituloTema = new Map(temas.map((t) => [t.id, t.titulo]));

  return (
    <>
      <Encabezado
        titulo="Cargar notas"
        subtitulo={`${grupoDe(cab)} · ${cab.asig.materia} · ${c}° cuatrimestre`}
        volver={`/materias/${id}?c=${c}`}
      />
      <CargarNotas
        asignacionId={id}
        cuatrimestre={c}
        hoy={hoy}
        temas={temas.filter((t) => t.cuatrimestre === c).map((t) => ({ id: t.id, titulo: t.titulo }))}
        alumnos={lista
          .filter(({ insc }) => insc.estado === "activo")
          .map(({ insc, alumno }) => ({ inscripcionId: insc.id, orden: insc.orden, nombre: `${alumno.apellido}, ${alumno.nombre}` }))}
        tipos={tipos.filter((t) => !t.oculta).map((t) => ({ clave: t.clave, nombre: t.nombre }))}
      />

      {tandas.size > 0 && (
        <section>
          <h2 className="titulo-seccion">Ya cargado este cuatrimestre</h2>
          <ul className="tarjeta divide-y divide-borde text-sm">
            {[...tandas.values()].slice(0, 15).map((t) => (
              <li key={`${t.fecha}${t.categoria}${t.temaId}`}>
                <Link
                  href={`/materias/${id}/notas/tanda?c=${c}&f=${t.fecha}&cat=${t.categoria}&t=${t.temaId ?? ""}`}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="w-24 shrink-0 text-xs text-texto-2">{fechaCortaMayus(t.fecha)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {nombreTipo[t.categoria] ?? t.categoria}
                    {t.temaId && <span className="text-texto-2"> · {tituloTema.get(t.temaId)}</span>}
                  </span>
                  <span className="text-xs text-texto-2">{t.cantidad} notas</span>
                  <span className="text-xs font-semibold text-tinta">Corregir</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-texto-2">Tocá una tanda para corregir notas, sumar a alguien que te faltó o cambiarle la fecha, la parte o el tema. Una nota suelta también se corrige desde la ficha del alumno.</p>
        </section>
      )}
    </>
  );
}
