"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NIVELES_EPS } from "@/db/constantes";
import { guardarPlan } from "../acciones";

type Estudiante = {
  inscripcionId: number;
  apellidoNombre: string;
  nivel: number | null;
  inicioEps: string;
  propuesta: string[];
  niveles: Record<number, string[]>;
};
type Encabezado = { oferta: string; region: string; sede: string; cfp: string; turno: string };

const VACIO = ["", "", "", "", ""];
const AREAS_FG = ["Prácticas de Lenguaje", "Matemáticas", "Ciencias Sociales", "Ciencias Naturales"];
const MI_AREA = "Ciencias Naturales";

export function EditorPlan({ asignacionId, encabezado, estudiantes }: { asignacionId: number; encabezado: Encabezado; estudiantes: Estudiante[] }) {
  const [modo, setModo] = useState<"editar" | "drive">("editar");
  const [elegido, setElegido] = useState(estudiantes[0]?.inscripcionId ?? null);
  const actual = estudiantes.find((e) => e.inscripcionId === elegido) ?? null;

  if (!estudiantes.length) {
    return <p className="tarjeta p-4 text-sm text-texto-2">No hay estudiantes activos en este grupo.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl border border-borde bg-hoja p-0.5 text-sm font-semibold sm:w-fit">
        {(
          [
            ["editar", "Cargar"],
            ["drive", "Vista para el Drive (todos)"],
          ] as const
        ).map(([m, t]) => (
          <button key={m} onClick={() => setModo(m)} className={`flex-1 rounded-lg px-3 py-1.5 ${modo === m ? "bg-tinta text-hoja" : "text-texto-2"}`}>
            {t}
          </button>
        ))}
      </div>

      {modo === "drive" ? (
        <div className="space-y-6">
          <p className="text-xs text-texto-2">Un plan por estudiante, con la misma forma que el modelo. Solo está completa la fila de {MI_AREA}.</p>
          {estudiantes.map((e) => <VistaDrive key={e.inscripcionId} enc={encabezado} e={e} />)}
        </div>
      ) : (
        <>
          <label className="block">
            <span className="etiqueta">Estudiante</span>
            <select value={elegido ?? ""} onChange={(ev) => setElegido(Number(ev.target.value))} className="campo">
              {estudiantes.map((e) => (
                <option key={e.inscripcionId} value={e.inscripcionId}>
                  {e.apellidoNombre} {e.nivel ? `· nivel ${e.nivel}` : "· sin nivel"}
                </option>
              ))}
            </select>
          </label>
          {actual && <FormEstudiante key={actual.inscripcionId} asignacionId={asignacionId} e={actual} />}
        </>
      )}
    </div>
  );
}

function FormEstudiante({ asignacionId, e }: { asignacionId: number; e: Estudiante }) {
  const router = useRouter();
  const [niveles, setNiveles] = useState<Record<number, string[]>>(() =>
    Object.fromEntries(NIVELES_EPS.map((n) => [n, [...(e.niveles[n] ?? VACIO)]])),
  );
  const [cambios, setCambios] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [pendiente, iniciar] = useTransition();

  function set(nivel: number, i: number, v: string) {
    setNiveles((s) => ({ ...s, [nivel]: s[nivel].map((x, j) => (j === i ? v : x)) }));
    setCambios(true);
    setMensaje(null);
  }

  function completar(nivel: number) {
    setNiveles((s) => ({ ...s, [nivel]: s[nivel].map((x, j) => x || e.propuesta[j] || "") }));
    setCambios(true);
  }

  function guardar() {
    iniciar(async () => {
      try {
        await guardarPlan({
          asignacionId,
          inscripcionId: e.inscripcionId,
          niveles: NIVELES_EPS.map((n) => ({ nivel: n, evaluaciones: niveles[n] })),
        });
        setCambios(false);
        setMensaje({ ok: true, texto: "Plan guardado." });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  async function copiar(nivel: number) {
    try {
      await navigator.clipboard.writeText(niveles[nivel].join("\t"));
      setCopiado(nivel);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setMensaje({ ok: false, texto: "El navegador no dejó copiar." });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-2">
        {e.nivel ? <>Está en el <b className="text-texto">nivel {e.nivel}</b>.</> : <>Todavía no le asignaste nivel (se carga en Cursos, en la lista de alumnos).</>}
        {e.inicioEps && <> Empezó la EPS en {e.inicioEps}.</>}
      </p>
      {NIVELES_EPS.map((n) => (
        <div key={n} className={`tarjeta p-3 ${n === e.nivel ? "border-tinta" : ""}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              Nivel {n} <span className="text-sm font-normal text-texto-2">· {MI_AREA}, registro de evaluaciones</span>
              {n === e.nivel && <span className="ml-2 rounded bg-tinta-suave px-1.5 text-xs font-bold text-tinta">actual</span>}
            </p>
            <span className="flex gap-3 text-xs font-semibold">
              {n === e.nivel && e.propuesta.length > 0 && (
                <button onClick={() => completar(n)} className="text-tinta">Completar con las notas</button>
              )}
              <button onClick={() => copiar(n)} className="text-texto-2">{copiado === n ? "Copiado ✓" : "Copiar fila"}</button>
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {niveles[n].map((v, i) => (
              <input
                key={i}
                value={v}
                onChange={(ev) => set(n, i, ev.target.value)}
                placeholder={n === e.nivel && e.propuesta[i] ? e.propuesta[i] : "–"}
                className="w-full rounded-lg border border-borde bg-papel px-1 py-2 text-center font-semibold outline-none placeholder:font-normal placeholder:text-texto-2/60 focus:border-tinta"
                aria-label={`Nivel ${n}, evaluación ${i + 1}`}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-texto-2">
        Cada casillero acepta número o texto corto (ej. 8, TEA, “aprobado”). En gris, lo que propone la app para el nivel actual: un casillero por tema con su promedio y el examen al final.
      </p>
      {(cambios || pendiente) && (
        <div className="sticky bottom-20 z-20">
          <button onClick={guardar} disabled={pendiente} className="boton-primario w-full py-3.5 text-base shadow-lg">
            {pendiente ? "Guardando…" : "Guardar plan"}
          </button>
        </div>
      )}
      {mensaje && <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
    </div>
  );
}

// Réplica de solo lectura del Modelo de Plan de trabajo formativo de un estudiante
function VistaDrive({ enc, e }: { enc: Encabezado; e: Estudiante }) {
  const celda = "border border-black/70 px-2 py-1";
  const gris = "border border-black/70 bg-[#dfe9f5] px-2 py-1 text-center";
  return (
    <div className="overflow-x-auto rounded-xl bg-white p-4 text-[12px] text-black" data-planilla="plan-formativo" data-estudiante={e.apellidoNombre}>
      <table className="mb-3 w-full border-collapse">
        <caption className="mb-1 text-center text-sm font-bold">Modelo PLAN DE TRABAJO FORMATIVO</caption>
        <tbody>
          <tr><td colSpan={4} className={celda}><b>Oferta:</b> {enc.oferta}</td></tr>
          <tr>
            <td className={celda}><b>Región:</b> {enc.region}</td>
            <td className={celda}><b>Sede:</b> {enc.sede}</td>
            <td className={celda}><b>CFP que articula:</b> {enc.cfp}</td>
            <td className={celda}><b>Turno:</b> {enc.turno}</td>
          </tr>
          <tr><td colSpan={4} className={celda}><b>Nombre y apellido del/la estudiante:</b> {e.apellidoNombre}</td></tr>
          <tr><td colSpan={4} className={celda}><b>Mes y año que comienza a cursar la EPS:</b> {e.inicioEps}</td></tr>
        </tbody>
      </table>
      {NIVELES_EPS.map((n) => {
        const ev = e.niveles[n] ?? VACIO;
        return (
          <table key={n} className="mb-2 w-full border-collapse">
            <thead>
              <tr>
                <th className={gris}>Nivel {n}</th>
                <th className={gris}>Formación Profesional</th>
                <th colSpan={5} className={gris}>Registro de evaluaciones</th>
                <th className={gris}>Formación General</th>
                <th colSpan={5} className={gris}>Registro de evaluaciones</th>
              </tr>
            </thead>
            <tbody>
              {AREAS_FG.map((area) => (
                <tr key={area}>
                  <td className={celda} />
                  <td className={celda}>Módulo…</td>
                  {VACIO.map((_, i) => <td key={i} className={`${celda} w-10`} />)}
                  <td className={`${celda} text-center`}>{area}</td>
                  {VACIO.map((_, i) => (
                    <td key={i} className={`${celda} w-10 text-center font-semibold`}>{area === MI_AREA ? ev[i] : ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
