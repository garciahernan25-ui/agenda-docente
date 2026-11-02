"use client";

import { useActionState } from "react";
import { ingresar } from "./actions";

export function FormLogin() {
  const [estado, accion, pendiente] = useActionState(ingresar, null);
  return (
    <form action={accion} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Contraseña</span>
        <input
          name="clave"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="campo"
        />
      </label>
      {estado?.error && <p className="text-sm text-red-600">{estado.error}</p>}
      <button disabled={pendiente} className="boton-primario w-full">
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
