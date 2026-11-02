"use server";

import { redirect } from "next/navigation";
import { cerrarSesion, iniciarSesion, verificarClave } from "@/lib/auth";

// Freno simple a intentos repetidos (por instancia del servidor)
let fallos = 0;
let bloqueadoHasta = 0;

export async function ingresar(_prev: { error: string } | null, form: FormData) {
  if (Date.now() < bloqueadoHasta) {
    return { error: "Demasiados intentos. Esperá un minuto." };
  }
  const clave = String(form.get("clave") ?? "");
  const hash = process.env.AGENDA_CLAVE_HASH;
  if (!hash) return { error: "Falta configurar AGENDA_CLAVE_HASH (ver README)." };

  if (!(await verificarClave(clave, hash))) {
    fallos++;
    if (fallos >= 5) {
      bloqueadoHasta = Date.now() + 60_000;
      fallos = 0;
    }
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Contraseña incorrecta." };
  }
  fallos = 0;
  await iniciarSesion();
  redirect("/");
}

export async function salir() {
  await cerrarSesion();
  redirect("/login");
}
