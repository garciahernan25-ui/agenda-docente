"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Categoria } from "@/db/constantes";
import { guardarTanda } from "../../acciones";

type Alumno = { inscripcionId: number; orden: number; nombre: string; notas: { id: number; valor: number }[] };

const fmt = (n: number) => String(n).replace(".", ",");
const valida = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 1 && n <= 10;
};

export function EditorTanda(props: {
  asignacionId: number;
  cuatrimestre: 1 | 2;
  volver: string;
  fecha: string;
  categoria: Categoria;
  tipos: { clave: string; nombre: string }[];
  temaId: number | null;
  temas: { id: number; titulo: string }[];
  alumnos: Alumno[];
}) {
  const router = useRouter();
  // Clave "n123" para una nota existente, "a45" para un alumno sin nota en esta tanda
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const a of props.alumnos) {
      if (a.notas.length) for (const n of a.notas) v[`n${n.id}`] = fmt(n.valor);
      else v[`a${a.inscripcionId}`] = "";
    }
    return v;
  });
  const [fecha, setFecha] = useState(props.fecha);
  const [categoria, setCategoria] = useState<Categoria>(props.categoria);
  const [tema, setTema] = useState(props.temaId?.toString() ?? "");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const original = new Map<string, string>(props.alumnos.flatMap((a) => a.notas.map((n): [string, string] => [`n${n.id}`, fmt(n.valor)])));
  const invalidos = Object.values(valores).filter((v) => v !== "" && !valida(v)).length;
  const aBorrar = [...original.keys()].filter((k) => valores[k] === "").length;
  const cambioEncabezado = fecha !== props.fecha || categoria !== props.categoria || tema !== (props.temaId?.toString() ?? "");
  const hayCambios = cambioEncabezado || Object.entries(valores).some(([k, v]) => (k.startsWith("n") ? original.get(k) !== v : v !== ""));
  const esExamen = categoria === "examen";

  function guardar() {
    if (invalidos) {
      setMensaje({ ok: false, texto: "Hay notas fuera de 1 a 10." });
      return;
    }
    if (aBorrar && !confirm(`Vas a borrar ${aBorrar} ${aBorrar === 1 ? "nota" : "notas"} que dejaste en blanco. ¿Seguimos?`)) return;
    iniciar(async () => {
      try {
        const num = (v: string) => Number(v.replace(",", "."));
        await guardarTanda({
          asignacionId: props.asignacionId,
          cuatrimestre: props.cuatrimestre,
          notaIds: [...original.keys()].map((k) => Number(k.slice(1))),
          cambios: [...original.entries()]
            .filter(([k, v]) => valores[k] !== v)
            .map(([k]) => ({ notaId: Number(k.slice(1)), valor: valores[k] === "" ? null : num(valores[k]) })),
          nuevas: Object.entries(valores)
            .filter(([k, v]) => k.startsWith("a") && v !== "")
            .map(([k, v]) => ({ inscripcionId: Number(k.slice(1)), valor: num(v) })),
          fecha,
          categoria,
          temaId: esExamen || tema === "" ? null : Number(tema),
        });
        router.push(props.volver);
      } catch {
        setMensaje({ ok: false, texto: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="tarjeta space-y-3 p-4">
        <p className="text-xs text-texto-2">Si te confundiste al cargarlas, acá le cambiás la parte, el tema o la fecha a toda la tanda.</p>
        <label className="block">
          <span className="etiqueta">Qué evaluaste</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="campo">
            {props.tipos.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}
          </select>
        </label>
        {!esExamen && (
          <label className="block">
            <span className="etiqueta">Tema</span>
            <select value={tema} onChange={(e) => setTema(e.target.value)} className="campo">
              <option value="">Sin tema</option>
              {props.temas.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="etiqueta">Fecha</span>
          <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="campo" />
        </label>
      </div>

      <ul className="tarjeta divide-y divide-borde">
        {props.alumnos.map((a) => {
          const claves = a.notas.length ? a.notas.map((n) => `n${n.id}`) : [`a${a.inscripcionId}`];
          return (
            <li key={a.inscripcionId} className="flex items-center gap-3 px-4 py-2">
              <span className="w-5 text-right text-xs tabular-nums text-texto-2">{a.orden}</span>
              <span className="flex-1 text-[15px]">
                {a.nombre}
                {!a.notas.length && <span className="block text-[11px] text-texto-2">sin nota en esta tanda</span>}
              </span>
              {claves.map((k) => {
                const v = valores[k] ?? "";
                const mal = v !== "" && !valida(v);
                const borrar = k.startsWith("n") && v === "";
                const cambio = k.startsWith("n") && original.get(k) !== v;
                return (
                  <input
                    key={k}
                    inputMode="decimal"
                    value={v}
                    onChange={(e) => { setValores((s) => ({ ...s, [k]: e.target.value })); setMensaje(null); }}
                    placeholder={borrar ? "borrar" : "–"}
                    className={`w-16 rounded-lg border px-2 py-2 text-center text-base font-semibold tabular-nums outline-none focus:border-tinta ${
                      mal ? "border-ausente bg-ausente-bg" : borrar ? "border-ausente bg-papel placeholder:text-xs placeholder:text-ausente" : cambio ? "border-tarde bg-tarde-bg" : "border-borde bg-papel"
                    }`}
                    aria-label={`Nota de ${a.nombre}`}
                  />
                );
              })}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-texto-2">Cambiá el número para corregirlo. Si la borrás y dejás el casillero vacío, esa nota se elimina.</p>

      <div className="sticky bottom-20 z-10">
        <button onClick={guardar} disabled={pendiente || !hayCambios} className="boton-primario w-full py-3.5 text-base shadow-lg">
          {pendiente ? "Guardando…" : hayCambios ? "Guardar correcciones" : "Sin cambios"}
        </button>
        {mensaje && <p className={`mt-1 text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
      </div>
    </div>
  );
}
