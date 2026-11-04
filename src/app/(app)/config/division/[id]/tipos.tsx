"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TipoEval } from "@/lib/tipos-comun";
import { copiarTipos, guardarTipos } from "../../actions";

type Fila = { clave: string | null; nombre: string; peso: string; fijo: boolean; oculta: boolean; conNotas: boolean; id: number };

// Tipos de evaluación de la materia: renombrar, cambiar pesos, ordenar, sacar y agregar. Quiz y examen son fijos.
export function EditorTipos({
  asignacionId,
  tipos,
  conNotas,
  otras,
}: {
  asignacionId: number;
  tipos: TipoEval[];
  conNotas: string[];
  otras: { id: number; texto: string }[];
}) {
  const router = useRouter();
  const inicial = () =>
    tipos.map((t, i) => ({ clave: t.clave, nombre: t.nombre, peso: String(t.peso), fijo: t.fijo, oculta: t.oculta, conNotas: conNotas.includes(t.clave), id: i }));
  const [filas, setFilas] = useState<Fila[]>(inicial);
  const [cambios, setCambios] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const visibles = filas.filter((f) => !f.oculta);
  const sacados = filas.filter((f) => f.oculta);
  const suma = visibles.reduce((s, f) => s + (Number(f.peso.replace(",", ".")) || 0), 0);

  function cambiar(id: number, cambio: Partial<Fila>) {
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambio } : f)));
    setCambios(true);
    setMensaje(null);
  }

  function mover(id: number, paso: -1 | 1) {
    setFilas((fs) => {
      const vis = fs.filter((f) => !f.oculta);
      const i = vis.findIndex((f) => f.id === id);
      const j = i + paso;
      if (j < 0 || j >= vis.length || vis[j].clave === "examen" || vis[i].clave === "examen") return fs;
      [vis[i], vis[j]] = [vis[j], vis[i]];
      return [...vis, ...fs.filter((f) => f.oculta)];
    });
    setCambios(true);
  }

  function sacar(f: Fila) {
    // Si nunca tuvo notas y es uno que agregaste vos, desaparece; si no, queda "sacado" (sus notas siguen contando)
    if (f.clave?.startsWith("x_") && !f.conNotas) setFilas((fs) => fs.filter((x) => x.id !== f.id));
    else if (f.clave === null) setFilas((fs) => fs.filter((x) => x.id !== f.id));
    else cambiar(f.id, { oculta: true });
    setCambios(true);
  }

  function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    if (filas.some((f) => f.nombre.toLowerCase() === nombre.toLowerCase())) {
      setMensaje({ ok: false, texto: "Ya hay un tipo con ese nombre." });
      return;
    }
    setFilas((fs) => {
      const vis = fs.filter((f) => !f.oculta);
      const examen = vis.findIndex((f) => f.clave === "examen");
      const fila: Fila = { clave: null, nombre, peso: "10", fijo: false, oculta: false, conNotas: false, id: Date.now() };
      const pos = examen === -1 ? vis.length : examen; // queda antes del examen
      return [...vis.slice(0, pos), fila, ...vis.slice(pos), ...fs.filter((f) => f.oculta)];
    });
    setNuevo("");
    setCambios(true);
  }

  function guardar() {
    const malPeso = filas.find((f) => !/^\d+([.,]\d+)?$/.test(f.peso.trim()) || Number(f.peso.replace(",", ".")) > 100);
    if (malPeso) return setMensaje({ ok: false, texto: `El peso de "${malPeso.nombre}" tiene que ser un número de 0 a 100.` });
    if (filas.some((f) => !f.nombre.trim())) return setMensaje({ ok: false, texto: "Hay un tipo sin nombre." });
    iniciar(async () => {
      try {
        await guardarTipos({
          asignacionId,
          tipos: filas.map((f) => ({ clave: f.clave, nombre: f.nombre.trim(), peso: Number(f.peso.replace(",", ".")), oculta: f.oculta })),
        });
        setCambios(false);
        setMensaje({ ok: true, texto: "Tipos de evaluación guardados ✓" });
        router.refresh();
      } catch (e) {
        setMensaje({ ok: false, texto: e instanceof Error && e.message ? e.message : "No se pudo guardar." });
      }
    });
  }

  function copiar(desde: number) {
    iniciar(async () => {
      try {
        await copiarTipos(desde, asignacionId);
        window.location.reload();
      } catch {
        setMensaje({ ok: false, texto: "No se pudieron copiar." });
      }
    });
  }

  return (
    <div className="mt-4 border-t border-borde pt-3">
      <p className="etiqueta">Tipos de evaluación y su peso en la nota del cuatrimestre</p>
      <ul className="space-y-1.5">
        {visibles.map((f, i) => (
          <li key={f.id} className="flex items-center gap-1.5">
            <span className="flex flex-col text-xs leading-none text-texto-2">
              <button type="button" onClick={() => mover(f.id, -1)} disabled={i === 0 || f.clave === "examen"} className="px-1 disabled:opacity-30" aria-label="Subir">▲</button>
              <button type="button" onClick={() => mover(f.id, 1)} disabled={f.clave === "examen" || visibles[i + 1]?.clave === "examen"} className="px-1 disabled:opacity-30" aria-label="Bajar">▼</button>
            </span>
            <input
              value={f.nombre}
              onChange={(e) => cambiar(f.id, { nombre: e.target.value })}
              readOnly={f.fijo}
              className={`min-w-0 flex-1 rounded-lg border border-borde bg-papel px-2 py-1.5 text-sm ${f.fijo ? "text-texto-2" : ""}`}
              aria-label="Nombre del tipo"
            />
            <input
              value={f.peso}
              onChange={(e) => cambiar(f.id, { peso: e.target.value })}
              inputMode="decimal"
              className="w-14 rounded-lg border border-borde bg-papel px-2 py-1.5 text-right text-sm"
              aria-label={`Peso de ${f.nombre}`}
            />
            {f.fijo ? (
              <span className="w-12 text-center text-[10px] text-texto-2" title={f.clave === "quiz" ? "Recibe las notas de la página de quizzes" : "Es la nota del cuatrimestre en la planilla"}>
                fijo
              </span>
            ) : (
              <button type="button" onClick={() => sacar(f)} className="w-12 text-xs font-semibold text-ausente">Sacar</button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-texto-2">
        Suman {String(Math.round(suma * 10) / 10).replace(".", ",")}. No hace falta que den 100: se usan como proporción. Quiz y Examen no se sacan (si no los usás, peso 0).
      </p>

      <div className="mt-2 flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregar())}
          placeholder="Nuevo tipo (Carpeta, Laboratorio…)"
          maxLength={40}
          className="campo py-2 text-sm"
        />
        <button type="button" onClick={agregar} className="boton shrink-0 px-3 text-sm">Agregar</button>
      </div>

      {sacados.length > 0 && (
        <div className="mt-3 rounded-xl border border-borde p-2 text-sm">
          <p className="text-xs text-texto-2">Sacados (no aparecen para cargar; las notas que ya tenían siguen contando):</p>
          <ul className="mt-1 space-y-1">
            {sacados.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <span className="text-texto-2">{f.nombre}{f.conNotas ? " · con notas" : ""}</span>
                <button type="button" onClick={() => cambiar(f.id, { oculta: false })} className="text-xs font-semibold text-tinta">Volver a usar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {otras.length > 0 && (
        <label className="mt-3 block">
          <span className="text-xs text-texto-2">O copiá los tipos de otra materia</span>
          <select defaultValue="" onChange={(e) => e.target.value && copiar(Number(e.target.value))} disabled={pendiente} className="campo py-2 text-sm">
            <option value="">Elegí la materia…</option>
            {otras.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
          </select>
        </label>
      )}

      {(cambios || pendiente) && (
        <button type="button" onClick={guardar} disabled={pendiente} className="boton-primario mt-3 w-full disabled:opacity-60">
          {pendiente ? "Guardando…" : "Guardar tipos de evaluación"}
        </button>
      )}
      {mensaje && <p className={`mt-2 text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
    </div>
  );
}
