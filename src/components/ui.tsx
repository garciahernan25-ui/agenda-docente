import Link from "next/link";
import type { ReactNode } from "react";

export function Encabezado({
  titulo,
  subtitulo,
  volver,
  accion,
}: {
  titulo: string;
  subtitulo?: string;
  volver?: string;
  accion?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-2 border-b border-borde bg-papel/95 px-4 py-3 backdrop-blur">
      {volver && (
        <Link href={volver} aria-label="Volver" className="-ml-2 rounded-full p-2 text-tinta">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold leading-tight">{titulo}</h1>
        {subtitulo && <p className="truncate text-xs text-texto-2">{subtitulo}</p>}
      </div>
      {accion}
    </header>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="tarjeta p-4 text-sm text-texto-2">{children}</p>;
}

export function Cargando() {
  return <p className="py-8 text-center text-sm text-texto-2">Cargando…</p>;
}

const COLOR_VAL: Record<string, string> = {
  TEA: "bg-presente-bg text-presente",
  TEP: "bg-tarde-bg text-tarde",
  TED: "bg-ausente-bg text-ausente",
};

export function Chip({ valor }: { valor: string | null | undefined }) {
  if (!valor) return <span className="text-texto-2">–</span>;
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${COLOR_VAL[valor] ?? ""}`}>{valor}</span>;
}

export function Nota({ valor }: { valor: number | null | undefined }) {
  if (valor === null || valor === undefined) return <span className="text-texto-2">–</span>;
  return <span className={`font-bold tabular-nums ${valor >= 7 ? "text-presente" : "text-ausente"}`}>{valor}</span>;
}

export function PorcentajeAsistencia({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-texto-2">–</span>;
  return (
    <span className={`tabular-nums ${valor < 75 ? "font-bold text-ausente" : "text-texto-2"}`}>
      {String(valor).replace(".", ",")}%
    </span>
  );
}
