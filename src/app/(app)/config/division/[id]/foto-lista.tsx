"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { mandarFoto } from "@/lib/foto-cliente";
import { agregarAlumnosLeidos } from "../../actions";

type Fila = { apellido: string; nombre: string; baja: boolean; dudoso: boolean; incluir: boolean };

// Otra forma de cargar la lista: sacarle una foto a la hoja. Se revisa antes de agregar.
export function FotoLista({ divisionId, eps }: { divisionId: number; eps: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const quien = eps ? "estudiantes" : "alumnos";

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setMensaje(null);
    setLeyendo(true);
    const r = await mandarFoto<{ alumnos: { apellido: string; nombre: string; tachado: boolean; dudoso: boolean }[] }>("/api/foto/lista", archivo);
    setLeyendo(false);
    if (input.current) input.current.value = "";
    if (!r.ok) return setMensaje({ ok: false, texto: r.mensaje });
    setFilas(r.datos.alumnos.map((a) => ({ apellido: a.apellido, nombre: a.nombre, baja: a.tachado, dudoso: a.dudoso, incluir: true })));
  }

  const cambiar = (i: number, c: Partial<Fila>) => setFilas((fs) => fs!.map((f, j) => (j === i ? { ...f, ...c } : f)));

  function agregar() {
    const elegidos = (filas ?? []).filter((f) => f.incluir && f.apellido.trim());
    if (!elegidos.length) return;
    iniciar(async () => {
      try {
        const r = await agregarAlumnosLeidos({
          divisionId,
          alumnos: elegidos.map((f) => ({ apellido: f.apellido.trim(), nombre: f.nombre.trim(), baja: f.baja })),
        });
        setFilas(null);
        setMensaje({ ok: true, texto: `Listo: se agregaron ${r.cantidad} ${quien}.` });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudieron agregar. Revisá que todos tengan apellido." });
      }
    });
  }

  return (
    <div className="mt-3 border-t border-borde pt-3">
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => leer(e.target.files?.[0])} />
      {!filas && (
        <button type="button" onClick={() => input.current?.click()} disabled={leyendo} className="boton w-full disabled:opacity-60">
          {leyendo ? "Leyendo la foto… (puede tardar unos segundos)" : "📷 O sacale una foto a la lista"}
        </button>
      )}

      {filas && (
        <div className="space-y-2">
          <p className="text-sm">
            Revisá lo que se leyó. En <span className="rounded bg-tarde-bg px-1 text-tarde">amarillo</span>, lo que no se leía bien. Los tachados quedan como baja.
          </p>
          <ul className="space-y-1.5">
            {filas.map((f, i) => (
              <li key={i} className={`grid grid-cols-[auto_1fr_1fr] items-center gap-1.5 rounded-lg p-1 ${f.dudoso ? "bg-tarde-bg" : ""} ${f.incluir ? "" : "opacity-40"}`}>
                <input type="checkbox" checked={f.incluir} onChange={(e) => cambiar(i, { incluir: e.target.checked })} className="size-4" aria-label="Agregar este" />
                <input value={f.apellido} onChange={(e) => cambiar(i, { apellido: e.target.value.toUpperCase(), dudoso: false })} className="min-w-0 rounded-lg border border-borde bg-papel px-2 py-1.5 text-sm" aria-label="Apellido" />
                <input value={f.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value, dudoso: false })} className="min-w-0 rounded-lg border border-borde bg-papel px-2 py-1.5 text-sm" aria-label="Nombre" />
                <label className="col-start-2 col-end-4 flex items-center gap-1.5 text-xs text-texto-2">
                  <input type="checkbox" checked={f.baja} onChange={(e) => cambiar(i, { baja: e.target.checked })} /> Baja
                </label>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFilas(null)} className="boton">Descartar</button>
            <button type="button" onClick={agregar} disabled={pendiente} className="boton-primario disabled:opacity-60">
              {pendiente ? "Agregando…" : `Agregar ${filas.filter((f) => f.incluir).length}`}
            </button>
          </div>
        </div>
      )}
      {mensaje && <p className={`mt-2 text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
    </div>
  );
}
