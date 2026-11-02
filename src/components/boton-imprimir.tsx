"use client";

export function BotonImprimir() {
  return (
    <button onClick={() => window.print()} className="rounded-lg bg-black px-3 py-1.5 font-semibold text-white">
      Imprimir / PDF
    </button>
  );
}
