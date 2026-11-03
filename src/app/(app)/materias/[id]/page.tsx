import Link from "next/link";
import { Suspense } from "react";
import { Cargando, Chip, Encabezado, Nota, PorcentajeAsistencia, Vacio } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { resumenMateria } from "@/lib/consultas";
import { cuatrimestreDe, hoyAR } from "@/lib/fechas";
import { grupoDe } from "@/lib/grupo";

export default function Materia(props: PageProps<"/materias/[id]">) {
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
  const c: 1 | 2 = sp.c === "1" ? 1 : sp.c === "2" ? 2 : cuatrimestreDe(hoyAR());
  const { cab, filas, clasesDictadas } = await resumenMateria(id, c);
  const activos = filas.filter((f) => !f.baja);
  const conPct = activos.filter((f) => f.asistencia.porcentaje !== null);
  const promAsis = conPct.length
    ? Math.round((conPct.reduce((s, f) => s + f.asistencia.porcentaje!, 0) / conPct.length) * 10) / 10
    : null;

  const base = `/materias/${id}`;
  return (
    <>
      <Encabezado
        titulo={`${grupoDe(cab)} · ${cab.asig.materia}`}
        subtitulo={`${cab.escuela.nombre} · ${cab.div.turno}`}
        volver="/"
      />

      <div className="grid grid-cols-2 gap-2">
        <Link href={`${base}/asistencia`} className="boton-primario col-span-2 py-3">Tomar asistencia</Link>
        <Link href={`${base}/temas?c=${c}`} className="boton py-3">Notas por tema</Link>
        <Link href={`${base}/notas?c=${c}`} className="boton py-3">Cargar por tipo</Link>
        {cab.modalidad.formato === "eps" ? (
          <>
            <Link href={`${base}/rite`} className="boton py-3">RITE</Link>
            <Link href={`${base}/plan`} className="boton py-3">Plan formativo</Link>
          </>
        ) : (
          <Link href={`${base}/planilla`} className="boton py-3">Planilla de notas</Link>
        )}
        <Link href={`${base}/cierre?c=${c}`} className="boton py-3">Cierre {c}° C</Link>
        <Link href={`${base}/planificacion`} className="boton py-3">Planificación anual</Link>
        <Link href={`${base}/proyectos`} className="boton py-3">Proyectos</Link>
        <Link
          href={`${base}/quizzes`}
          className={`boton py-3 ${cab.modalidad.formato === "eps" ? "" : "col-span-2"}`}
        >
          Traer notas de quizzes
        </Link>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex rounded-xl border border-borde bg-hoja p-0.5 text-sm font-semibold">
          {[1, 2].map((n) => (
            <Link
              key={n}
              href={`${base}?c=${n}`}
              className={`rounded-lg px-3 py-1.5 ${n === c ? "bg-tinta text-hoja" : "text-texto-2"}`}
            >
              {n}° cuatri
            </Link>
          ))}
        </div>
        <p className="text-right text-xs text-texto-2">
          {clasesDictadas} clases
          {promAsis !== null && (
            <>
              <br />
              asistencia <PorcentajeAsistencia valor={promAsis} />
            </>
          )}
        </p>
      </div>

      <h2 className="titulo-seccion">Alumnos</h2>
      {filas.length === 0 ? (
        <Vacio>
          Esta división no tiene alumnos.{" "}
          <Link href={`/config/division/${cab.div.id}`} className="font-semibold text-tinta">Cargar lista</Link>
        </Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-borde">
          <li className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-texto-2">
            <span className="flex-1">Alumno</span>
            <span className="w-12 text-right">Asist.</span>
            <span className="w-10 text-center">Val.</span>
            <span className="w-8 text-right">Nota</span>
          </li>
          {filas.map((f) => {
            const val = c === 1 ? f.cierre?.valoracion1 : f.cierre?.valoracion2;
            const nota = (c === 1 ? f.cierre?.calificacion1 : f.cierre?.calificacion2) ?? f.calculada?.entera ?? null;
            return (
              <li key={f.inscripcionId}>
                <Link
                  href={`${base}/alumnos/${f.inscripcionId}?c=${c}`}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm ${f.baja ? "text-texto-2" : ""}`}
                >
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-texto-2">{f.orden}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {f.nombre}
                    {f.baja && <span className="text-xs"> · baja</span>}
                  </span>
                  <span className="w-12 text-right text-xs">
                    <PorcentajeAsistencia valor={f.asistencia.porcentaje} />
                  </span>
                  <span className="w-10 text-center"><Chip valor={val} /></span>
                  <span className="w-8 text-right"><Nota valor={nota} /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-texto-2">La nota es la confirmada en el cierre o, si todavía no la confirmaste, la calculada con los pesos.</p>
    </>
  );
}
