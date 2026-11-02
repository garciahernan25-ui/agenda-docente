"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { VALORACIONES, type Valoracion } from "@/db/constantes";
import { valoracionDesdeNota } from "@/lib/calculos";
import { guardarRite } from "../acciones";

type Fila = {
  inscripcionId: number;
  apellidoNombre: string;
  calculada1: number | null;
  calculada2: number | null;
  sugerida1: Valoracion | null;
  sugerida2: Valoracion | null;
  valoracion1: Valoracion | null;
  calificacion1: number | null;
  valoracion2: Valoracion | null;
  calificacion2: number | null;
  calificacionFinal: number | null;
  observacionRite: string;
};
type Contextual = { capacidades: string; actividades: string; dificultades: string; observaciones: string };
type Encabezado = { distrito: string; region: string; familiaProfesional: string; nivel: string; area: string; docente: string; correo: string };

const PREGUNTAS: [keyof Contextual, string][] = [
  ["capacidades", "¿Qué capacidades se pudieron trabajar durante los cuatro primeros meses de actividades?"],
  ["actividades", "¿Qué actividades se propusieron?"],
  ["dificultades", "¿Qué dificultades se presentaron?"],
  ["observaciones", "Observaciones"],
];
const NOTAS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

// En el RITE el número va en la columna de su categoría (TEA, TEP o TED)
function informe(val: Valoracion | null, nota: number | null) {
  const v = val ?? (nota !== null ? valoracionDesdeNota(nota) : null);
  return { TEA: v === "TEA" ? nota ?? "✓" : "", TEP: v === "TEP" ? nota ?? "✓" : "", TED: v === "TED" ? nota ?? "✓" : "" };
}

export function EditorRite(props: { asignacionId: number; ciclo: number; encabezado: Encabezado; contextual: Contextual; filas: Fila[] }) {
  const router = useRouter();
  const [modo, setModo] = useState<"editar" | "drive">("editar");
  const [ctx, setCtx] = useState(props.contextual);
  const [filas, setFilas] = useState(props.filas);
  const [cambios, setCambios] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState("");
  const [pendiente, iniciar] = useTransition();

  function set<K extends keyof Fila>(i: number, campo: K, valor: Fila[K]) {
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
    setCambios(true);
    setMensaje(null);
  }

  // Completa los vacíos con lo que propone la app, sin pisar lo que pusiste
  function completar() {
    setFilas((f) =>
      f.map((x) => {
        const cal1 = x.calificacion1 ?? x.calculada1;
        const cal2 = x.calificacion2 ?? x.calculada2;
        return {
          ...x,
          calificacion1: cal1,
          valoracion1: x.valoracion1 ?? x.sugerida1 ?? (cal1 !== null ? valoracionDesdeNota(cal1) : null),
          calificacion2: cal2,
          valoracion2: x.valoracion2 ?? x.sugerida2 ?? (cal2 !== null ? valoracionDesdeNota(cal2) : null),
        };
      }),
    );
    setCambios(true);
  }

  function guardar() {
    iniciar(async () => {
      try {
        await guardarRite({
          asignacionId: props.asignacionId,
          contextual: ctx,
          filas: filas.map((f) => ({
            inscripcionId: f.inscripcionId,
            valoracion1: f.valoracion1,
            calificacion1: f.calificacion1,
            valoracion2: f.valoracion2,
            calificacion2: f.calificacion2,
            calificacionFinal: f.calificacionFinal,
            observacionRite: f.observacionRite,
          })),
        });
        setCambios(false);
        setMensaje({ ok: true, texto: "RITE guardado." });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  async function copiar(que: "tabla" | "contextual") {
    const limpiar = (s: unknown) => String(s ?? "").replace(/[\t\r\n]+/g, " ").trim();
    const tsv =
      que === "tabla"
        ? filas
            .map((f, i) => {
              const a = informe(f.valoracion1, f.calificacion1);
              const b = informe(f.valoracion2, f.calificacion2);
              return [i + 1, f.apellidoNombre, a.TEA, a.TEP, a.TED, b.TEA, b.TEP, b.TED, f.calificacionFinal ?? "", f.observacionRite].map(limpiar).join("\t");
            })
            .join("\n")
        : PREGUNTAS.map(([k]) => limpiar(ctx[k])).join("\t");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopiado(que);
      setTimeout(() => setCopiado(""), 2500);
    } catch {
      setMensaje({ ok: false, texto: "El navegador no dejó copiar. Probá desde la vista para el Drive seleccionando la tabla." });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-borde bg-hoja p-0.5 text-sm font-semibold">
          {(
            [
              ["editar", "Cargar"],
              ["drive", "Vista para el Drive"],
            ] as const
          ).map(([m, t]) => (
            <button key={m} onClick={() => setModo(m)} className={`rounded-lg px-3 py-1.5 ${modo === m ? "bg-tinta text-hoja" : "text-texto-2"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => copiar("tabla")} className="boton">{copiado === "tabla" ? "Copiado ✓" : "Copiar tabla de estudiantes"}</button>
        <button onClick={() => copiar("contextual")} className="boton">{copiado === "contextual" ? "Copiado ✓" : "Copiar informe contextual"}</button>
      </div>
      <p className="text-xs text-texto-2">
        “Copiar” deja los datos listos para pegar en el Google Sheets del Drive: hacé clic en la primera celda (el N° 1 o la primera pregunta) y pegá con Ctrl+V.
      </p>

      {modo === "drive" ? (
        <VistaDrive ciclo={props.ciclo} enc={props.encabezado} ctx={ctx} filas={filas} />
      ) : (
        <>
          <section className="tarjeta space-y-3 p-4">
            <h2 className="font-bold">Informe contextual</h2>
            {PREGUNTAS.map(([k, p]) => (
              <label key={k} className="block">
                <span className="etiqueta">{p}</span>
                <textarea
                  rows={3}
                  value={ctx[k]}
                  onChange={(e) => { setCtx((c) => ({ ...c, [k]: e.target.value })); setCambios(true); }}
                  className="campo text-sm"
                />
              </label>
            ))}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Registro de trayectorias</h2>
            <button onClick={completar} className="text-sm font-semibold text-tinta underline">Completar los vacíos con las notas</button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-borde bg-hoja">
            <table className="w-full border-collapse text-sm">
              <thead className="text-[10px] font-bold uppercase leading-tight tracking-wide text-texto-2">
                <tr className="border-b border-borde">
                  <th className="sticky left-0 z-10 bg-hoja px-2 py-2 text-left">N°</th>
                  <th className="sticky left-7 z-10 min-w-[150px] bg-hoja px-2 text-left">Apellido y nombre</th>
                  <th className="border-l border-borde px-2" colSpan={2}>Primer informe</th>
                  <th className="border-l border-borde px-2" colSpan={2}>Segundo informe</th>
                  <th className="border-l border-borde px-2">Valoración final</th>
                  <th className="border-l border-borde px-2 text-left">Observaciones sobre el/la estudiante</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.inscripcionId} className="border-b border-borde align-top last:border-0">
                    <td className="sticky left-0 z-10 bg-hoja px-2 py-2 text-right text-xs tabular-nums text-texto-2">{i + 1}</td>
                    <td className="sticky left-7 z-10 bg-hoja px-2 py-2"><span className="block max-w-[180px] truncate">{f.apellidoNombre}</span></td>
                    <td className="border-l border-borde px-1 py-1"><SelVal valor={f.valoracion1} propuesta={f.sugerida1} onChange={(v) => set(i, "valoracion1", v)} /></td>
                    <td className="px-1 py-1"><SelNota valor={f.calificacion1} propuesta={f.calculada1} onChange={(v) => set(i, "calificacion1", v)} /></td>
                    <td className="border-l border-borde px-1 py-1"><SelVal valor={f.valoracion2} propuesta={f.sugerida2} onChange={(v) => set(i, "valoracion2", v)} /></td>
                    <td className="px-1 py-1"><SelNota valor={f.calificacion2} propuesta={f.calculada2} onChange={(v) => set(i, "calificacion2", v)} /></td>
                    <td className="border-l border-borde px-1 py-1"><SelNota valor={f.calificacionFinal} onChange={(v) => set(i, "calificacionFinal", v)} /></td>
                    <td className="border-l border-borde px-1 py-1">
                      <textarea
                        rows={2}
                        value={f.observacionRite}
                        onChange={(e) => set(i, "observacionRite", e.target.value)}
                        placeholder="Ej.: transita de manera óptima el nivel IV…"
                        className="w-full min-w-[260px] rounded-md border border-transparent bg-papel px-2 py-1 text-xs outline-none focus:border-tinta"
                      />
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-3 text-texto-2">No hay estudiantes activos en este grupo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-texto-2">En gris, lo que propone la app con tus notas. El número se pasa al Drive en la columna TEA, TEP o TED que elijas.</p>
        </>
      )}

      {(cambios || pendiente) && (
        <div className="sticky bottom-20 z-20 mx-auto max-w-xl">
          <button onClick={guardar} disabled={pendiente} className="boton-primario w-full py-3.5 text-base shadow-lg">
            {pendiente ? "Guardando…" : "Guardar RITE"}
          </button>
        </div>
      )}
      {mensaje && <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
    </div>
  );
}

function SelNota({ valor, propuesta, onChange }: { valor: number | null; propuesta?: number | null; onChange: (v: number | null) => void }) {
  const gris = valor === null && propuesta !== null && propuesta !== undefined;
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className={`w-full min-w-[52px] appearance-none rounded-md border border-transparent bg-papel py-1.5 text-center font-bold tabular-nums outline-none focus:border-tinta ${gris ? "font-normal text-texto-2/70" : valor === null ? "text-texto-2" : valor >= 7 ? "text-presente" : "text-ausente"}`}
      aria-label="Nota"
    >
      <option value="">{gris ? String(propuesta) : "–"}</option>
      {NOTAS.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

function SelVal({ valor, propuesta, onChange }: { valor: Valoracion | null; propuesta: Valoracion | null; onChange: (v: Valoracion | null) => void }) {
  const color: Record<Valoracion, string> = { TEA: "text-presente", TEP: "text-tarde", TED: "text-ausente" };
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as Valoracion))}
      className={`w-full min-w-[58px] appearance-none rounded-md border border-transparent bg-papel py-1.5 text-center text-xs font-bold outline-none focus:border-tinta ${valor ? color[valor] : "font-normal text-texto-2/70"}`}
      aria-label="Valoración"
    >
      <option value="">{propuesta ?? "–"}</option>
      {VALORACIONES.map((v) => <option key={v} value={v}>{v}</option>)}
    </select>
  );
}

// Réplica de solo lectura de la planilla del Drive: misma estructura, texto plano en cada celda
function VistaDrive({ ciclo, enc, ctx, filas }: { ciclo: number; enc: Encabezado; ctx: Contextual; filas: Fila[] }) {
  const celda = "border border-black/60 px-2 py-1";
  const cab = "border border-black/60 bg-[#dfe9f5] px-2 py-1 font-bold text-black";
  return (
    <div className="overflow-x-auto rounded-xl bg-white p-4 text-[12px] text-black" data-planilla="rite-eps">
      <table className="mb-4 border-collapse">
        <caption className="mb-2 text-left text-base font-bold">EDUCACIÓN PROFESIONAL SECUNDARIA</caption>
        <tbody>
          {(
            [
              ["DISTRITO", enc.distrito],
              ["REGIÓN", enc.region],
              ["FAMILIA PROFESIONAL", enc.familiaProfesional],
              ["NIVEL", enc.nivel],
              ["ÁREA", enc.area],
              ["DOCENTE", enc.docente],
              ["CORREO ELECTRÓNICO", enc.correo],
            ] as const
          ).map(([k, v]) => (
            <tr key={k}><th className={`${cab} text-left`}>{k}</th><td className={`${celda} min-w-[280px] text-center`}>{v}</td></tr>
          ))}
        </tbody>
      </table>

      <table className="mb-4 w-full border-collapse">
        <caption className="mb-1 text-left font-bold">INFORME CONTEXTUAL</caption>
        <thead><tr>{PREGUNTAS.map(([k, p]) => <th key={k} className={`${cab} uppercase`}>{p}</th>)}</tr></thead>
        <tbody><tr>{PREGUNTAS.map(([k]) => <td key={k} className={`${celda} align-top whitespace-pre-wrap`}>{ctx[k]}</td>)}</tr></tbody>
      </table>

      <table className="w-full border-collapse">
        <caption className="mb-1 text-left font-bold">REGISTRO DE TRAYECTORIAS EDUCATIVAS {ciclo}</caption>
        <thead>
          <tr>
            <th rowSpan={2} className={cab}>Nº</th>
            <th rowSpan={2} className={cab}>APELLIDO Y NOMBRE</th>
            <th colSpan={3} className={cab}>PRIMER INFORME CUALITATIVO</th>
            <th colSpan={3} className={cab}>SEGUNDO INFORME CUALITATIVO</th>
            <th rowSpan={2} className={cab}>VALORACIÓN FINAL (NUMÉRICA)</th>
            <th rowSpan={2} className={cab}>OBSERVACIONES QUE CONSIDERE IMPORTANTES SOBRE EL/ LA ESTUDIANTE</th>
          </tr>
          <tr>{["T.E.A", "T.E.P.", "T.E.D.", "T.E.A", "T.E.P.", "T.E.D."].map((t, i) => <th key={i} className={cab}>{t}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const a = informe(f.valoracion1, f.calificacion1);
            const b = informe(f.valoracion2, f.calificacion2);
            return (
              <tr key={f.inscripcionId}>
                <td className={`${celda} text-center`}>{i + 1}</td>
                <td className={celda}>{f.apellidoNombre}</td>
                {[a.TEA, a.TEP, a.TED, b.TEA, b.TEP, b.TED].map((v, j) => <td key={j} className={`${celda} w-12 text-center`}>{v}</td>)}
                <td className={`${celda} text-center`}>{f.calificacionFinal ?? ""}</td>
                <td className={celda}>{f.observacionRite}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
