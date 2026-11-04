"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Categoria } from "@/db/constantes";
import { guardarNotas } from "../acciones";

type Alumno = { inscripcionId: number; orden: number; nombre: string };

const NUEVO = "__nuevo__";

export function CargarNotas(props: {
  asignacionId: number;
  cuatrimestre: 1 | 2;
  hoy: string;
  temas: { id: number; titulo: string }[];
  alumnos: Alumno[];
  tipos: { clave: string; nombre: string }[];
}) {
  const router = useRouter();
  const [categoria, setCategoria] = useState<Categoria>(() => (props.tipos.some((t) => t.clave === "tp_escrito") ? "tp_escrito" : (props.tipos[0]?.clave ?? "examen")));
  const [tema, setTema] = useState<string>(props.temas.at(-1)?.id.toString() ?? (props.temas.length ? "" : NUEVO));
  const [temaNuevo, setTemaNuevo] = useState("");
  const [fecha, setFecha] = useState(props.hoy);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const esExamen = categoria === "examen";
  const invalidos = Object.entries(valores).filter(([, v]) => v !== "" && !valida(v));
  const cargadas = Object.values(valores).filter((v) => v !== "" && valida(v)).length;

  function guardar() {
    setMensaje(null);
    if (invalidos.length) {
      setMensaje({ tipo: "error", texto: "Hay notas fuera de 1 a 10." });
      return;
    }
    if (!esExamen && tema === NUEVO && !temaNuevo.trim()) {
      setMensaje({ tipo: "error", texto: "Escribí el nombre del tema nuevo." });
      return;
    }
    iniciar(async () => {
      try {
        const r = await guardarNotas({
          asignacionId: props.asignacionId,
          cuatrimestre: props.cuatrimestre,
          categoria,
          temaId: esExamen || tema === NUEVO || tema === "" ? null : Number(tema),
          temaNuevo: !esExamen && tema === NUEVO ? temaNuevo.trim() : undefined,
          fecha,
          valores: Object.entries(valores)
            .filter(([, v]) => v !== "")
            .map(([id, v]) => ({ inscripcionId: Number(id), valor: Number(v.replace(",", ".")) })),
        });
        setValores({});
        if (r.temaId && tema === NUEVO) {
          setTema(String(r.temaId));
          setTemaNuevo("");
        }
        setMensaje({ tipo: "ok", texto: `Se guardaron ${r.cantidad} notas.` });
        router.refresh();
      } catch {
        setMensaje({ tipo: "error", texto: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="tarjeta space-y-3 p-4">
        <label className="block">
          <span className="etiqueta">Qué evaluás</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="campo">
            {props.tipos.map((t) => (
              <option key={t.clave} value={t.clave}>{t.nombre}</option>
            ))}
          </select>
        </label>

        {!esExamen && (
          <label className="block">
            <span className="etiqueta">Tema</span>
            <select value={tema} onChange={(e) => setTema(e.target.value)} className="campo">
              <option value="">Sin tema</option>
              {props.temas.map((t) => (
                <option key={t.id} value={t.id}>{t.titulo}</option>
              ))}
              <option value={NUEVO}>+ Tema nuevo…</option>
            </select>
            {tema === NUEVO && (
              <input
                value={temaNuevo}
                onChange={(e) => setTemaNuevo(e.target.value)}
                placeholder="Nombre del tema (ej. Estados de la materia)"
                className="campo mt-2"
                autoFocus
              />
            )}
          </label>
        )}

        <label className="block">
          <span className="etiqueta">Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="campo" />
        </label>
      </div>

      <ul className="tarjeta divide-y divide-borde">
        {props.alumnos.map((a, i) => {
          const v = valores[a.inscripcionId] ?? "";
          const mal = v !== "" && !valida(v);
          return (
            <li key={a.inscripcionId} className="flex items-center gap-3 px-4 py-2">
              <span className="w-5 text-right text-xs tabular-nums text-texto-2">{a.orden}</span>
              <label htmlFor={`n${a.inscripcionId}`} className="flex-1 text-[15px]">{a.nombre}</label>
              <input
                id={`n${a.inscripcionId}`}
                inputMode="decimal"
                enterKeyHint={i === props.alumnos.length - 1 ? "done" : "next"}
                value={v}
                onChange={(e) => setValores((s) => ({ ...s, [a.inscripcionId]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    document.getElementById(`n${props.alumnos[i + 1]?.inscripcionId}`)?.focus();
                  }
                }}
                placeholder="–"
                className={`w-16 rounded-lg border px-2 py-2 text-center text-base font-semibold tabular-nums outline-none focus:border-tinta ${mal ? "border-ausente bg-ausente-bg" : "border-borde bg-papel"}`}
                aria-label={`Nota de ${a.nombre}`}
              />
            </li>
          );
        })}
        {props.alumnos.length === 0 && <li className="px-4 py-3 text-sm text-texto-2">No hay alumnos activos.</li>}
      </ul>
      <p className="text-xs text-texto-2">Dejá en blanco a quien no corresponde. Escala 1 a 10, se aceptan decimales (7,5).</p>

      <div className="sticky bottom-20 z-10">
        <button onClick={guardar} disabled={pendiente || cargadas === 0} className="boton-primario w-full py-3.5 text-base shadow-lg">
          {pendiente ? "Guardando…" : `Guardar ${cargadas || ""} notas`}
        </button>
        {mensaje && (
          <p className={`mt-1 text-center text-sm ${mensaje.tipo === "ok" ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>
        )}
      </div>
    </div>
  );
}

function valida(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 1 && n <= 10;
}
