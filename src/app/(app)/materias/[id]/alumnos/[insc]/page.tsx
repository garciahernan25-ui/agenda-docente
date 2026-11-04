import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { alumnos, asistencias, clases, cierres, inscripciones, notas, type EstadoAsistencia } from "@/db/schema";
import { Cargando, Chip, Encabezado, Nota, PorcentajeAsistencia } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { calificacionPonderada, promediosPorCategoria, resumenAsistencia } from "@/lib/calculos";
import { cabecera, pesosDe, temasDe } from "@/lib/consultas";
import { cuatrimestreDe, fechaCortaMayus, fechaMini, hoyAR } from "@/lib/fechas";
import { tiposDe } from "@/lib/tipos";
import { NotaEditable } from "./borrar";
import { grupoDe } from "@/lib/grupo";

export default function Ficha(props: PageProps<"/materias/[id]/alumnos/[insc]">) {
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
  params: Promise<{ id: string; insc: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirDocente();
  const p = await params;
  const id = Number(p.id);
  const inscId = Number(p.insc);
  const sp = await searchParams;
  const c: 1 | 2 = sp.c === "1" ? 1 : sp.c === "2" ? 2 : cuatrimestreDe(hoyAR());

  const cab = await cabecera(id);
  const [fila] = await db
    .select({ insc: inscripciones, alumno: alumnos })
    .from(inscripciones)
    .innerJoin(alumnos, eq(inscripciones.alumnoId, alumnos.id))
    .where(and(eq(inscripciones.id, inscId), eq(inscripciones.divisionId, cab.div.id)));
  if (!fila) notFound();

  const [ns, cls, regs, [cierre], temas, pesos, tipos] = await Promise.all([
    db.select().from(notas).where(and(eq(notas.asignacionId, id), eq(notas.inscripcionId, inscId), eq(notas.cuatrimestre, c))).orderBy(asc(notas.fecha)),
    db.select().from(clases).where(and(eq(clases.asignacionId, id), eq(clases.cuatrimestre, c), eq(clases.dictada, true))).orderBy(asc(clases.fecha)),
    db.select().from(asistencias).where(eq(asistencias.inscripcionId, inscId)),
    db.select().from(cierres).where(and(eq(cierres.asignacionId, id), eq(cierres.inscripcionId, inscId))),
    temasDe(id),
    pesosDe(id),
    tiposDe(id),
  ]);
  const nombreTipo = Object.fromEntries(tipos.map((t) => [t.clave, t.nombre]));
  const estadoPorClase = new Map(regs.map((r) => [r.claseId, r.estado]));
  const historial = cls.map((cl) => ({ fecha: cl.fecha, estado: estadoPorClase.get(cl.id) ?? null }));
  const asis = resumenAsistencia(historial.map((h) => h.estado).filter((e): e is EstadoAsistencia => !!e));
  const calc = calificacionPonderada(ns, pesos);
  const proms = promediosPorCategoria(ns);
  const temasC = temas.filter((t) => t.cuatrimestre === c);
  const grupos = [
    ...temasC.map((t) => ({ titulo: t.titulo, notas: ns.filter((n) => n.temaId === t.id) })),
    { titulo: "Sin tema", notas: ns.filter((n) => !n.temaId) },
  ].filter((g) => g.notas.length);

  return (
    <>
      <Encabezado
        titulo={`${fila.alumno.apellido}, ${fila.alumno.nombre}`}
        subtitulo={`${grupoDe(cab)} · ${cab.asig.materia} · ${c}° cuatrimestre${fila.insc.estado === "baja" ? " · baja" : ""}`}
        volver={`/materias/${id}?c=${c}`}
      />

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="tarjeta p-3">
          <p className="text-xs text-texto-2">Asistencia</p>
          <p className="text-lg font-bold"><PorcentajeAsistencia valor={asis.porcentaje} /></p>
          <p className="text-[11px] text-texto-2">{String(asis.inasistencias).replace(".", ",")} faltas</p>
        </div>
        <div className="tarjeta p-3">
          <p className="text-xs text-texto-2">Calculada</p>
          <p className="text-lg"><Nota valor={calc?.entera} /></p>
          <p className="text-[11px] text-texto-2">{calc ? String(calc.exacta).replace(".", ",") : "sin notas"}</p>
        </div>
        <div className="tarjeta p-3">
          <p className="text-xs text-texto-2">Cierre</p>
          <p className="text-lg"><Nota valor={c === 1 ? cierre?.calificacion1 : cierre?.calificacion2} /></p>
          <p className="text-[11px]"><Chip valor={c === 1 ? cierre?.valoracion1 : cierre?.valoracion2} /></p>
        </div>
      </div>

      <h2 className="titulo-seccion">Promedio por parte</h2>
      <ul className="tarjeta divide-y divide-borde text-sm">
        {tipos.filter((t) => !t.oculta || proms[t.clave] !== undefined).map(({ clave: cat }) => (
          <li key={cat} className="flex items-center justify-between px-4 py-2">
            <span>
              {nombreTipo[cat]} <span className="text-xs text-texto-2">· peso {pesos[cat] ?? 0}</span>
            </span>
            <span className="tabular-nums">{proms[cat] !== undefined ? String(Math.round(proms[cat]! * 10) / 10).replace(".", ",") : <span className="text-texto-2">–</span>}</span>
          </li>
        ))}
      </ul>

      <h2 className="titulo-seccion">Notas por tema <span className="font-normal normal-case tracking-normal">· tocá una nota para corregirla</span></h2>
      {grupos.length === 0 && <p className="tarjeta p-4 text-sm text-texto-2">Sin notas este cuatrimestre.</p>}
      <div className="space-y-3">
        {grupos.map((g) => (
          <div key={g.titulo} className="tarjeta">
            <p className="border-b border-borde px-4 py-2 text-sm font-semibold">{g.titulo}</p>
            <ul className="divide-y divide-borde text-sm">
              {g.notas.map((n) => (
                <li key={n.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-20 shrink-0 text-xs text-texto-2">{fechaCortaMayus(n.fecha)}</span>
                  <span className="flex-1">
                    {nombreTipo[n.categoria] ?? n.categoria}
                    {n.origen === "quiz" && <span className="text-xs text-texto-2"> · desde quizzes</span>}
                  </span>
                  <NotaEditable key={`${n.id}-${n.valor}`} asignacionId={id} notaId={n.id} valor={n.valor} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="titulo-seccion">Asistencia clase por clase</h2>
      {historial.length === 0 ? (
        <p className="tarjeta p-4 text-sm text-texto-2">Todavía no hay clases registradas.</p>
      ) : (
        <div className="tarjeta flex flex-wrap gap-1.5 p-3">
          {historial.map((h) => (
            <span
              key={h.fecha}
              title={fechaCortaMayus(h.fecha)}
              className={`rounded-md px-1.5 py-1 text-center text-[11px] leading-tight ${
                h.estado === "A" ? "bg-ausente-bg text-ausente" : h.estado === "T" ? "bg-tarde-bg text-tarde" : h.estado === "J" ? "bg-justif-bg text-justif" : h.estado === "P" ? "bg-presente-bg text-presente" : "border border-borde text-texto-2"
              }`}
            >
              {fechaMini(h.fecha)}
              <br />
              <b>{h.estado ?? "·"}</b>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
