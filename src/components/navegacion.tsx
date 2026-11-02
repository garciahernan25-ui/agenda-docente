"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Inicio", icono: IconoInicio },
  { href: "/calendario", label: "Calendario", icono: IconoCalendario },
  { href: "/config", label: "Cursos", icono: IconoCursos },
];

export function BarraInferior({ sinRuta = false }: { sinRuta?: boolean }) {
  return sinRuta ? <Barra ruta="" /> : <BarraConRuta />;
}

function BarraConRuta() {
  return <Barra ruta={usePathname()} />;
}

function Barra({ ruta }: { ruta: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-hoja/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map(({ href, label, icono: Icono }) => {
          const activo = href === "/" ? ruta === "/" || ruta.startsWith("/materias") : ruta.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${activo ? "text-tinta" : "text-texto-2"}`}
              >
                <Icono />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function IconoInicio() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function IconoCalendario() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconoCursos() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z" />
      <path d="M18 8h1a1 1 0 0 1 1 1v11M8 9h6M8 13h6" />
    </svg>
  );
}
