"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

// Borrar en dos toques: el primero muestra qué se pierde, el segundo confirma.
export function BotonBorrar({
  accion,
  campos,
  texto = "Borrar",
  aviso,
}: {
  accion: (form: FormData) => Promise<void>;
  campos: Record<string, string | number>;
  texto?: string;
  aviso: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm font-semibold text-ausente">
        {texto}
      </button>
    );
  }

  return (
    <form action={accion} className="rounded-xl border border-ausente/50 bg-ausente/10 p-3 text-sm">
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <p>{aviso} No se puede deshacer.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => setAbierto(false)} className="boton flex-1">
          Cancelar
        </button>
        <Confirmar />
      </div>
    </form>
  );
}

function Confirmar() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="flex-1 rounded-xl bg-ausente px-3 py-2 font-semibold text-white disabled:opacity-60">
      {pending ? "Borrando…" : "Sí, borrar"}
    </button>
  );
}
