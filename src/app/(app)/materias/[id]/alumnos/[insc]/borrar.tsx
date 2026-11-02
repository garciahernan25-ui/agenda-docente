"use client";

import { useState, useTransition } from "react";
import { borrarNota, cambiarNota } from "../../acciones";

// Nota de la ficha: tocás el número para corregirlo, o la × para borrarla
export function NotaEditable({ asignacionId, notaId, valor }: { asignacionId: number; notaId: number; valor: number }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(String(valor).replace(".", ","));
  const [pendiente, iniciar] = useTransition();
  const n = Number(texto.replace(",", "."));
  const valida = Number.isFinite(n) && n >= 1 && n <= 10;

  function guardar() {
    if (!valida) return;
    if (n === valor) return setEditando(false);
    iniciar(async () => {
      await cambiarNota(asignacionId, notaId, n);
      setEditando(false);
    });
  }

  if (editando) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") setEditando(false);
          }}
          className={`w-14 rounded-lg border px-1.5 py-1 text-center font-semibold tabular-nums outline-none ${valida ? "border-tinta bg-papel" : "border-ausente bg-ausente-bg"}`}
          aria-label="Nueva nota"
        />
        <button onClick={guardar} disabled={!valida || pendiente} className="rounded-md bg-tinta px-2 py-1 text-xs font-bold text-hoja disabled:opacity-40" aria-label="Guardar nota">
          ✓
        </button>
        <button onClick={() => { setTexto(String(valor).replace(".", ",")); setEditando(false); }} className="px-1 text-texto-2" aria-label="Cancelar">
          ✕
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        onClick={() => setEditando(true)}
        className={`min-w-8 rounded-md px-1.5 py-0.5 text-right font-bold tabular-nums underline decoration-dotted underline-offset-4 ${valor >= 7 ? "text-presente" : "text-ausente"}`}
        aria-label={`Corregir nota ${valor}`}
      >
        {String(valor).replace(".", ",")}
      </button>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          if (confirm("¿Borrar esta nota?")) iniciar(() => borrarNota(asignacionId, notaId));
        }}
        className="rounded-md px-1.5 text-texto-2 disabled:opacity-40"
        aria-label="Borrar nota"
      >
        ×
      </button>
    </span>
  );
}
