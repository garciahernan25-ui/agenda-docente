"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { VALORACIONES, type Valoracion } from "@/db/constantes";
import { calificacionImpresa, totalesDeFilas, type CierreFila, type FilaPlanillaEditable } from "@/lib/planilla-calculos";
import type { FilaTotales } from "@/lib/calculos";
import { guardarCierre } from "../acciones";

type Campo = keyof CierreFila;

export function EditorPlanilla({
  asignacionId,
  filas,
  clases,
}: {
  asignacionId: number;
  filas: FilaPlanillaEditable[];
  clases: { totales1: number | null; totales2: number | null; dadas1: number | null; dadas2: number | null };
}) {
  const router = useRouter();
  const inicial = useMemo(() => Object.fromEntries(filas.map((f) => [f.inscripcionId, f.cierre])), [filas]);
  const [datos, setDatos] = useState<Record<number, CierreFila>>(inicial);
  const [cambiados, setCambiados] = useState<Set<number>>(new Set());
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const totales = totalesDeFilas(filas, datos);
  const hayCambios = cambiados.size > 0;
  const pdf = `/api/asignaciones/${asignacionId}/planilla-calificaciones`;

  function set(id: number, campo: Campo, valor: string) {
    const v = valor === "" ? null : campo.startsWith("valoracion") ? (valor as Valoracion) : Number(valor);
    setDatos((d) => ({ ...d, [id]: { ...d[id], [campo]: v } }));
    setCambiados((s) => new Set(s).add(id));
    setMensaje(null);
  }

  // Pasa lo propuesto (gris) a confirmado, sin pisar lo que ya pusiste
  function confirmarPropuestas(c: 1 | 2) {
    const val = c === 1 ? "valoracion1" : "valoracion2";
    const cal = c === 1 ? "calificacion1" : "calificacion2";
    const nuevos = new Set(cambiados);
    const n = { ...datos };
    for (const f of filas) {
      if (f.baja) continue;
      const x = { ...n[f.inscripcionId] };
      const sug = c === 1 ? f.sugerida1 : f.sugerida2;
      const calc = c === 1 ? f.calculada1 : f.calculada2;
      let cambio = false;
      if (x[val] === null && sug) { x[val] = sug; cambio = true; }
      if (x[cal] === null && calc !== null) { x[cal] = calc; cambio = true; }
      if (cambio) { n[f.inscripcionId] = x; nuevos.add(f.inscripcionId); }
    }
    setDatos(n);
    setCambiados(nuevos);
    setMensaje(null);
  }

  function descartar() {
    setDatos(inicial);
    setCambiados(new Set());
    setMensaje(null);
  }

  function guardar() {
    iniciar(async () => {
      try {
        await guardarCierre({
          asignacionId,
          filas: [...cambiados].map((id) => ({ inscripcionId: id, ...datos[id] })),
        });
        setCambiados(new Set());
        setMensaje({ ok: true, texto: "Planilla guardada." });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <a
          href={`${pdf}?ver=1`}
          target="_blank"
          rel="noopener"
          aria-disabled={hayCambios}
          onClick={(e) => hayCambios && e.preventDefault()}
          className={`boton-primario ${hayCambios ? "pointer-events-none opacity-50" : ""}`}
        >
          Ver e imprimir PDF
        </a>
        <a href={pdf} aria-disabled={hayCambios} onClick={(e) => hayCambios && e.preventDefault()} className={`boton ${hayCambios ? "pointer-events-none opacity-50" : ""}`}>
          Descargar PDF
        </a>
        <details className="relative">
          <summary className="boton cursor-pointer list-none">Asistencia PDF</summary>
          <div className="absolute z-20 mt-1 flex w-44 flex-col rounded-xl border border-borde bg-hoja p-1 text-sm shadow-lg">
            {[1, 2].map((c) => (
              <a key={c} href={`/api/asignaciones/${asignacionId}/planilla-asistencia?cuatrimestre=${c}&ver=1`} target="_blank" rel="noopener" className="rounded-lg px-3 py-2 hover:bg-papel">
                {c}° cuatrimestre
              </a>
            ))}
          </div>
        </details>
      </div>
      {hayCambios && <p className="text-xs text-tarde">Tenés cambios sin guardar. Guardá para que salgan en el PDF.</p>}

      <p className="text-xs text-texto-2">
        Tocá cualquier casillero de valoración o calificación para cambiarlo. Lo que está <span className="font-semibold text-texto-2/70">en gris</span> es lo que propone la app
        (calculado con tus notas) y todavía no confirmaste; igual sale impreso así.
      </p>

      {/* En el celu la tabla se desliza de costado; el nombre queda fijo */}
      <div>
        <div className="overflow-x-auto rounded-2xl border border-borde bg-hoja">
          <table className="w-full border-collapse text-[13px]">
            <thead className="text-[10px] font-bold uppercase leading-tight tracking-wide text-texto-2">
              <tr className="border-b border-borde">
                <th rowSpan={2} className="sticky left-0 z-10 bg-hoja px-2 py-2 text-left">N°</th>
                <th rowSpan={2} className="sticky left-7 z-10 min-w-[150px] bg-hoja px-2 py-2 text-left">Apellido y nombre</th>
                <th rowSpan={2} className="px-1">C/R</th>
                <th colSpan={4} className="border-l border-borde px-1 py-1.5">1° cuatrimestre</th>
                <th colSpan={5} className="border-l border-borde px-1 py-1.5">2° cuatrimestre</th>
                <th colSpan={2} className="border-l border-borde px-1 py-1.5">Intensificación</th>
                <th rowSpan={2} className="border-l border-borde px-1">Calif. final</th>
              </tr>
              <tr className="border-b border-borde">
                <th className="border-l border-borde px-1 py-1.5">Parciales</th>
                <th className="px-1">Val. prelim.</th>
                <th className="px-1">Calif.</th>
                <th className="px-1">Inas.</th>
                <th className="border-l border-borde px-1">Parciales</th>
                <th className="px-1">Val. prelim.</th>
                <th className="px-1">Calif.</th>
                <th className="px-1">Intens. 1° C</th>
                <th className="px-1">Inas.</th>
                <th className="border-l border-borde px-1">Dic.</th>
                <th className="px-1">Feb.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const x = datos[f.inscripcionId];
                const cal1 = calificacionImpresa(f, x, 1);
                const editado = cambiados.has(f.inscripcionId);
                return (
                  <tr key={f.inscripcionId} className={`border-b border-borde last:border-0 ${f.baja ? "text-texto-2" : ""} ${editado ? "bg-tarde-bg/40" : ""}`}>
                    <td className="sticky left-0 z-10 bg-hoja px-2 py-1 text-right text-xs tabular-nums text-texto-2">{f.orden}</td>
                    <td className="sticky left-7 z-10 bg-hoja px-2 py-1">
                      <span className="block max-w-[190px] truncate">{f.apellidoNombre}</span>
                      {(f.baja || f.observacion) && (
                        <span className="block text-[10px] text-texto-2">{[f.baja && "baja", f.observacion].filter(Boolean).join(" · ")}</span>
                      )}
                    </td>
                    <td className="px-1 text-center">{f.cursaRecursa}</td>

                    <td className="border-l border-borde px-1 text-center text-xs tabular-nums text-texto-2">{f.parciales1.join(" ") || "–"}</td>
                    <td className="px-0.5"><SelectVal valor={x.valoracion1} propuesta={f.sugerida1} onChange={(v) => set(f.inscripcionId, "valoracion1", v)} /></td>
                    <td className="px-0.5"><SelectNota valor={x.calificacion1} propuesta={f.calculada1} onChange={(v) => set(f.inscripcionId, "calificacion1", v)} /></td>
                    <td className="px-1 text-center text-xs tabular-nums">{fmt(f.inasistencias1)}</td>

                    <td className="border-l border-borde px-1 text-center text-xs tabular-nums text-texto-2">{f.parciales2.join(" ") || "–"}</td>
                    <td className="px-0.5"><SelectVal valor={x.valoracion2} propuesta={f.sugerida2} onChange={(v) => set(f.inscripcionId, "valoracion2", v)} /></td>
                    <td className="px-0.5"><SelectNota valor={x.calificacion2} propuesta={f.calculada2} onChange={(v) => set(f.inscripcionId, "calificacion2", v)} /></td>
                    <td className="px-0.5">
                      {/* Solo para quien tuvo menos de 7 en el 1° cuatrimestre */}
                      {(cal1 !== null && cal1 < 7) || x.intensificacion1 !== null ? (
                        <SelectNota valor={x.intensificacion1} onChange={(v) => set(f.inscripcionId, "intensificacion1", v)} />
                      ) : (
                        <span className="block text-center text-texto-2">–</span>
                      )}
                    </td>
                    <td className="px-1 text-center text-xs tabular-nums">{fmt(f.inasistencias2)}</td>

                    <td className="border-l border-borde px-0.5"><SelectNota valor={x.diciembre} onChange={(v) => set(f.inscripcionId, "diciembre", v)} /></td>
                    <td className="px-0.5"><SelectNota valor={x.febrero} onChange={(v) => set(f.inscripcionId, "febrero", v)} /></td>
                    <td className="border-l border-borde px-0.5"><SelectNota valor={x.calificacionFinal} onChange={(v) => set(f.inscripcionId, "calificacionFinal", v)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button onClick={() => confirmarPropuestas(1)} className="boton">Confirmar lo propuesto del 1° C</button>
        <button onClick={() => confirmarPropuestas(2)} className="boton">Confirmar lo propuesto del 2° C</button>
        <Link href={`/materias/${asignacionId}/cierre`} className="boton">Cierre alumno por alumno</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
        <CuadroTotales c1={totales.c1} c2={totales.c2} />
        <div className="tarjeta overflow-hidden text-sm">
          <table className="w-full">
            <thead className="text-[11px] font-bold uppercase text-texto-2">
              <tr className="border-b border-borde"><th className="px-3 py-2 text-left">Clases</th><th className="px-2">1° C</th><th className="px-2">2° C</th></tr>
            </thead>
            <tbody>
              <tr className="border-b border-borde"><td className="px-3 py-1.5">Total de la materia</td><td className="text-center">{fmt(clases.totales1)}</td><td className="text-center">{fmt(clases.totales2)}</td></tr>
              <tr><td className="px-3 py-1.5">Efectivamente dadas</td><td className="text-center">{fmt(clases.dadas1)}</td><td className="text-center">{fmt(clases.dadas2)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* La barra de guardar aparece solo cuando hay algo para guardar */}
      {(hayCambios || pendiente) && (
        <div className="sticky bottom-20 z-20 mx-auto flex max-w-xl gap-2">
          <button onClick={descartar} disabled={pendiente} className="boton bg-hoja py-3.5 shadow-lg">Descartar</button>
          <button onClick={guardar} disabled={pendiente} className="boton-primario flex-1 py-3.5 text-base shadow-lg">
            {pendiente ? "Guardando…" : `Guardar cambios (${cambiados.size} ${cambiados.size === 1 ? "alumno" : "alumnos"})`}
          </button>
        </div>
      )}
      {mensaje && <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
    </div>
  );
}

const NOTAS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function SelectNota({ valor, propuesta, onChange }: { valor: number | null; propuesta?: number | null; onChange: (v: string) => void }) {
  const gris = valor === null && propuesta !== null && propuesta !== undefined;
  const color = valor === null ? "text-texto-2" : valor >= 7 ? "text-presente" : "text-ausente";
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full min-w-[46px] appearance-none rounded-md border border-transparent bg-transparent py-1.5 text-center font-bold tabular-nums hover:border-borde focus:border-tinta focus:outline-none ${gris ? "font-normal text-texto-2/70" : color}`}
    >
      <option value="">{gris ? String(propuesta) : "–"}</option>
      {NOTAS.map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}

function SelectVal({ valor, propuesta, onChange }: { valor: Valoracion | null; propuesta: Valoracion | null; onChange: (v: string) => void }) {
  const color: Record<Valoracion, string> = { TEA: "text-presente", TEP: "text-tarde", TED: "text-ausente" };
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full min-w-[54px] appearance-none rounded-md border border-transparent bg-transparent py-1.5 text-center text-xs font-bold hover:border-borde focus:border-tinta focus:outline-none ${valor ? color[valor] : "font-normal text-texto-2/70"}`}
    >
      <option value="">{propuesta ?? "–"}</option>
      {VALORACIONES.map((v) => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  );
}

function CuadroTotales({ c1, c2 }: { c1?: FilaTotales; c2?: FilaTotales }) {
  const filas: [string, keyof FilaTotales][] = [
    ["Total de estudiantes", "total"],
    ["Aprobadas/os", "aprobados"],
    ["Desaprobadas/os", "desaprobados"],
    ["Sin evaluar", "sinEvaluar"],
  ];
  return (
    <div className="tarjeta overflow-hidden text-sm">
      <table className="w-full">
        <thead className="text-[11px] font-bold uppercase text-texto-2">
          <tr className="border-b border-borde"><th className="px-3 py-2 text-left">Totales</th><th className="px-2">1° C</th><th className="px-2">2° C</th></tr>
        </thead>
        <tbody>
          {filas.map(([t, k]) => (
            <tr key={k} className="border-b border-borde last:border-0">
              <td className="px-3 py-1.5">{t}</td>
              <td className="text-center tabular-nums">{c1 ? c1[k] : "–"}</td>
              <td className="text-center tabular-nums">{c2 ? c2[k] : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmt(n: number | null) {
  if (n === null) return "–";
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}
