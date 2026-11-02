// Filtro rápido: sin cookie de sesión válida no se entra a nada salvo al login.
// Cada página, acción y ruta de API vuelve a chequear la sesión por su cuenta.
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, tokenValido } from "@/lib/sesion";

export async function proxy(req: NextRequest) {
  const ok = await tokenValido(req.cookies.get(COOKIE_SESION)?.value);
  const enLogin = req.nextUrl.pathname === "/login";
  if (ok && enLogin) return NextResponse.redirect(new URL("/", req.url));
  if (ok || enLogin) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  // todo menos archivos estáticos
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|icons/|sw.js|offline.html|\\.well-known/).*)"],
};
