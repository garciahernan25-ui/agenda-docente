"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CATEGORIAS, type Categoria } from "@/db/constantes";
import { NOMBRE_CATEGORIA } from "@/lib/textos";
import { crearTema, guardarGrillaTema, renombrarTema } from "../acciones";

// Todas las formas de evaluar un tema (el examen es del cuatrimestre, no de un tema)
const COLUMNAS = CATEGORIAS.filter((c) => c !== "examen");
const CORTO: Record<Categoria, string> = {
  participacion: "Particip.",
  desempeno: "Desemp.",
  tp_escrito: "TP escrito",
  actividad_virtual: "Act. virtual",
  oral: "Oral",
  quiz: "Quiz",
  examen: "Examen",
};

type NotaCelda = { id: number; categoria: Categoria; valor: number; origen: string };
type Alumno = { inscripcionId: number; orden: number; nombre: string; notas: NotaCelda[] };

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const num = (v: string) => Number(v.replace(",", "."));
const valida = (v: string) => v === "" || (Number.isFinite(num(v)) && num(v) >= 1 && num(v) <= 10);
const clave = (insc: number, cat: Categoria) => `${insc}|${cat}`;

export function GrillaTema(props: {
  asignacionId: number;
  cuatrimestre: 1 | 2;
  hoy: string;
  temas: { id: number; titulo: string }[];
  tema: { id: number; titulo: string } | null;
  alumnos: Alumno[];
}) {
  const router = useRouter();
  const base = `/materias/${props.asignacionId}/temas?c=${props.cuatrimestre}`;

  // Un casillero = una nota. Si en un casillero hay más de una (ej. dos TP del mismo tema), se muestra sin editar.
  const original: Record<string, { notaId: number | null; texto: string; varias: NotaCelda[] }> = {};
  for (const a of props.alumnos) {
    for (const cat of COLUMNAS) {
      const ns = a.notas.filter((n) => n.categoria === cat);
      original[clave(a.inscripcionId, cat)] = {
        notaId: ns.length === 1 ? ns[0].id : null,
        texto: ns.length === 1 ? fmt(ns[0].valor) : "",
        varias: ns.length > 1 ? ns : [],
      };
    }
  }
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(original).map(([k, v]) => [k, v.texto])),
  );
  const [fecha, setFecha] = useState(props.hoy);
  const [nuevoTema, setNuevoTema] = useState("");
  const [renombrando, setRenombrando] = useState(false);
  const [titulo, setTitulo] = useState(props.tema?.titulo ?? "");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cambiadas = Object.keys(valores).filter((k) => valores[k] !== original[k].texto);
  const invalidas = cambiadas.filter((k) => !valida(valores[k]));
  const aBorrar = cambiadas.filter((k) => valores[k] === "" && original[k].notaId !== null).length;

  function promedioAlumno(a: Alumno) {
    const vals: number[] = [];
    for (const cat of COLUMNAS) {
      const o = original[clave(a.inscripcionId, cat)];
      if (o.varias.length) vals.push(...o.varias.map((n) => n.valor));
      else {
        const v = valores[clave(a.inscripcionId, cat)];
        if (v !== "" && valida(v)) vals.push(num(v));
      }
    }
    return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
  }

  function agregarTema() {
    const t = nuevoTema.trim();
    if (!t) return;
    iniciar(async () => {
      const idNuevo = await crearTema(props.asignacionId, props.cuatrimestre, t);
      setNuevoTema("");
      router.push(`${base}&t=${idNuevo}`);
    });
  }

  function guardarTitulo() {
    if (!props.tema || !titulo.trim()) return;
    iniciar(async () => {
      await renombrarTema(props.asignacionId, props.tema!.id, titulo);
      setRenombrando(false);
      router.refresh();
    });
  }

  function guardar() {
    if (!props.tema) return;
    if (invalidas.length) {
      setMensaje({ ok: false, texto: "Hay notas fuera de 1 a 10." });
      return;
    }
    if (aBorrar && !confirm(`Vas a borrar ${aBorrar} ${aBorrar === 1 ? "nota" : "notas"} que dejaste en blanco. ¿Seguimos?`)) return;
    iniciar(async () => {
      try {
        await guardarGrillaTema({
          asignacionId: props.asignacionId,
          cuatrimestre: props.cuatrimestre,
          temaId: props.tema!.id,
          fecha,
          celdas: cambiadas.map((k) => {
            const [insc, cat] = k.split("|");
            return {
              inscripcionId: Number(insc),
              categoria: cat as Categoria,
              notaId: original[k].notaId,
              valor: valores[k] === "" ? null : num(valores[k]),
            };
          }),
        });
        setMensaje({ ok: true, texto: "Notas del tema guardadas." });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-borde bg-hoja p-0.5 text-sm font-semibold">
          {[1, 2].map((n) => (
            <Link
              key={n}
              href={`/materias/${props.asignacionId}/temas?c=${n}`}
              className={`rounded-lg px-3 py-1.5 ${n === props.cuatrimestre ? "bg-tinta text-hoja" : "text-texto-2"}`}
            >
              {n}° cuatri
            </Link>
          ))}
        </div>
      </div>

      {/* Temas del cuatrimestre */}
      <div className="flex flex-wrap gap-2">
        {props.temas.map((t) => (
          <Link
            key={t.id}
            href={`${base}&t=${t.id}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${t.id === props.tema?.id ? "border-tinta bg-tinta text-hoja" : "border-borde bg-hoja"}`}
          >
            {t.titulo}
          </Link>
        ))}
        <span className="flex items-center gap-1">
          <input
            value={nuevoTema}
            onChange={(e) => setNuevoTema(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregarTema()}
            placeholder="Tema nuevo…"
            className="w-40 rounded-lg border border-dashed border-borde bg-transparent px-3 py-1.5 text-sm outline-none focus:border-tinta"
          />
          {nuevoTema.trim() && (
            <button onClick={agregarTema} disabled={pendiente} className="rounded-lg bg-tinta px-3 py-1.5 text-sm font-semibold text-hoja">
              Crear
            </button>
          )}
        </span>
      </div>

      {!props.tema ? (
        <p className="tarjeta p-4 text-sm text-texto-2">Todavía no hay temas en este cuatrimestre. Escribí el primero arriba y tocá Crear.</p>
      ) : (
        <>
          <div className="tarjeta flex flex-wrap items-end gap-3 p-3">
            <div className="min-w-0 flex-1">
              {renombrando ? (
                <span className="flex gap-2">
                  <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo py-1.5" autoFocus />
                  <button onClick={guardarTitulo} className="boton-primario py-1.5">OK</button>
                </span>
              ) : (
                <p className="text-lg font-bold">
                  {props.tema.titulo}{" "}
                  <button onClick={() => setRenombrando(true)} className="text-xs font-normal text-tinta">renombrar</button>
                </p>
              )}
              <p className="text-xs text-texto-2">Cargá en cualquier casillero; los vacíos no cuentan. El promedio es el que va a la planilla como nota del tema.</p>
            </div>
            <label className="text-xs text-texto-2">
              Fecha de las notas nuevas
              <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="campo mt-1 py-1.5" />
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-borde bg-hoja">
            <table className="w-full border-collapse text-sm">
              <thead className="text-[10px] font-bold uppercase leading-tight tracking-wide text-texto-2">
                <tr className="border-b border-borde">
                  <th className="sticky left-0 z-10 bg-hoja px-2 py-2 text-left">N°</th>
                  <th className="sticky left-7 z-10 min-w-[140px] bg-hoja px-2 text-left">Alumno</th>
                  {COLUMNAS.map((c) => (
                    <th key={c} className="px-1 text-center" title={NOMBRE_CATEGORIA[c]}>{CORTO[c]}</th>
                  ))}
                  <th className="border-l border-borde px-2 text-center">Prom.</th>
                </tr>
              </thead>
              <tbody>
                {props.alumnos.map((a, i) => {
                  const prom = promedioAlumno(a);
                  return (
                    <tr key={a.inscripcionId} className="border-b border-borde last:border-0">
                      <td className="sticky left-0 z-10 bg-hoja px-2 text-right text-xs tabular-nums text-texto-2">{a.orden}</td>
                      <td className="sticky left-7 z-10 bg-hoja px-2 py-1">
                        <span className="block max-w-[170px] truncate">{a.nombre}</span>
                      </td>
                      {COLUMNAS.map((cat, j) => {
                        const k = clave(a.inscripcionId, cat);
                        const o = original[k];
                        if (o.varias.length) {
                          return (
                            <td key={cat} className="px-1 text-center text-xs" title="Hay más de una nota: corregilas desde la ficha del alumno">
                              <Link href={`/materias/${props.asignacionId}/alumnos/${a.inscripcionId}?c=${props.cuatrimestre}`} className="text-tinta underline decoration-dotted">
                                {o.varias.map((n) => fmt(n.valor)).join(" · ")}
                              </Link>
                            </td>
                          );
                        }
                        const v = valores[k];
                        const cambio = v !== o.texto;
                        const mal = !valida(v);
                        return (
                          <td key={cat} className="px-0.5 py-1">
                            <input
                              id={`c-${i}-${j}`}
                              inputMode="decimal"
                              value={v}
                              placeholder={cambio && v === "" ? "borrar" : "–"}
                              onChange={(e) => { setValores((s) => ({ ...s, [k]: e.target.value })); setMensaje(null); }}
                              onKeyDown={(e) => {
                                // Enter baja al alumno siguiente en la misma columna
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  document.getElementById(`c-${i + 1}-${j}`)?.focus();
                                }
                              }}
                              className={`w-full min-w-[46px] rounded-md border px-1 py-1.5 text-center font-semibold tabular-nums outline-none focus:border-tinta ${
                                mal ? "border-ausente bg-ausente-bg" : cambio ? (v === "" ? "border-ausente bg-papel placeholder:text-[10px] placeholder:text-ausente" : "border-tarde bg-tarde-bg") : "border-transparent bg-papel"
                              }`}
                              aria-label={`${NOMBRE_CATEGORIA[cat]} de ${a.nombre}`}
                            />
                          </td>
                        );
                      })}
                      <td className={`border-l border-borde px-2 text-center font-bold tabular-nums ${prom === null ? "text-texto-2" : prom >= 7 ? "text-presente" : "text-ausente"}`}>
                        {prom === null ? "–" : fmt(prom)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-texto-2">Enter baja al siguiente alumno. Para borrar una nota, vaciá el casillero. Los quizzes de tu web van a caer solos en la columna Quiz cuando los conectemos.</p>

          {(cambiadas.length > 0 || pendiente) && (
            <div className="sticky bottom-20 z-20 mx-auto max-w-xl">
              <button onClick={guardar} disabled={pendiente} className="boton-primario w-full py-3.5 text-base shadow-lg">
                {pendiente ? "Guardando…" : `Guardar ${cambiadas.length} ${cambiadas.length === 1 ? "cambio" : "cambios"}`}
              </button>
            </div>
          )}
          {mensaje && <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
        </>
      )}
    </div>
  );
}
