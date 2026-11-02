"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { VALORACIONES, type Valoracion } from "@/db/constantes";
import { guardarCierre } from "../acciones";

type Cierre = {
  valoracion1: Valoracion | null;
  calificacion1: number | null;
  valoracion2: Valoracion | null;
  calificacion2: number | null;
  intensificacion1: number | null;
  diciembre: number | null;
  febrero: number | null;
  calificacionFinal: number | null;
};

type Fila = {
  inscripcionId: number;
  orden: number;
  nombre: string;
  calculada: { exacta: number; entera: number } | null;
  cantidadNotas: number;
  sugerida: Valoracion | null;
  inasistencias: number | null;
  cierre: Cierre;
};

const VAL = (c: 1 | 2): "valoracion1" | "valoracion2" => (c === 1 ? "valoracion1" : "valoracion2");
const CAL = (c: 1 | 2): "calificacion1" | "calificacion2" => (c === 1 ? "calificacion1" : "calificacion2");

export function EditorCierre({ asignacionId, cuatrimestre: c, filas }: { asignacionId: number; cuatrimestre: 1 | 2; filas: Fila[] }) {
  const router = useRouter();
  const [datos, setDatos] = useState<Record<number, Cierre>>(() => Object.fromEntries(filas.map((f) => [f.inscripcionId, f.cierre])));
  const [cambiado, setCambiado] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function set(id: number, campo: keyof Cierre, valor: string) {
    const v = valor === "" ? null : campo.startsWith("valoracion") ? (valor as Valoracion) : Number(valor);
    setDatos((d) => ({ ...d, [id]: { ...d[id], [campo]: v } }));
    setCambiado(true);
    setMensaje(null);
  }

  // Completa los vacíos con lo calculado y lo sugerido; no pisa lo que ya pusiste
  function completar() {
    setDatos((d) => {
      const n = { ...d };
      for (const f of filas) {
        const x = { ...n[f.inscripcionId] };
        if (x[VAL(c)] === null && f.sugerida) x[VAL(c)] = f.sugerida;
        if (x[CAL(c)] === null && f.calculada) x[CAL(c)] = f.calculada.entera;
        n[f.inscripcionId] = x;
      }
      return n;
    });
    setCambiado(true);
  }

  function guardar() {
    iniciar(async () => {
      try {
        await guardarCierre({
          asignacionId,
          filas: Object.entries(datos).map(([id, x]) => ({ inscripcionId: Number(id), ...x })),
        });
        setCambiado(false);
        setMensaje({ ok: true, texto: "Cierre guardado." });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudo guardar. Revisá que las notas sean enteros de 1 a 10." });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-tinta-suave p-3 text-sm text-tinta">
        La app te propone la valoración (con las notas de los dos primeros meses) y la calificación (promedio ponderado). Vos confirmás o cambiás.
        <button onClick={completar} className="mt-2 block font-semibold underline">Completar los vacíos con lo propuesto</button>
      </div>

      <ul className="space-y-2">
        {filas.map((f) => {
          const x = datos[f.inscripcionId];
          const cal1 = x.calificacion1;
          return (
            <li key={f.inscripcionId} className="tarjeta p-3">
              <div className="flex items-baseline gap-2">
                <span className="w-5 text-right text-xs tabular-nums text-texto-2">{f.orden}</span>
                <Link href={`/materias/${asignacionId}/alumnos/${f.inscripcionId}?c=${c}`} className="flex-1 font-medium">{f.nombre}</Link>
                <span className="text-xs text-texto-2">
                  {f.calculada ? <>calc. {String(f.calculada.exacta).replace(".", ",")}</> : "sin notas"}
                  {f.inasistencias !== null && <> · {String(f.inasistencias).replace(".", ",")} faltas</>}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label>
                  <span className="text-[11px] text-texto-2">Valoración {f.sugerida && <>· sug. <b>{f.sugerida}</b></>}</span>
                  <select value={x[VAL(c)] ?? ""} onChange={(e) => set(f.inscripcionId, VAL(c), e.target.value)} className="campo py-2">
                    <option value="">–</option>
                    {VALORACIONES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </label>
                <CampoNota etiqueta={`Calificación ${c}° C`} sugerida={f.calculada?.entera} valor={x[CAL(c)]} onChange={(v) => set(f.inscripcionId, CAL(c), v)} />
                {c === 2 && (
                  <>
                    {cal1 !== null && cal1 < 7 && (
                      <CampoNota etiqueta="Intensif. 1° C" valor={x.intensificacion1} onChange={(v) => set(f.inscripcionId, "intensificacion1", v)} />
                    )}
                    <CampoNota etiqueta="Diciembre" valor={x.diciembre} onChange={(v) => set(f.inscripcionId, "diciembre", v)} />
                    <CampoNota etiqueta="Febrero" valor={x.febrero} onChange={(v) => set(f.inscripcionId, "febrero", v)} />
                    <CampoNota etiqueta="Calificación final" valor={x.calificacionFinal} onChange={(v) => set(f.inscripcionId, "calificacionFinal", v)} />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-20 z-10">
        <button onClick={guardar} disabled={pendiente || !cambiado} className="boton-primario w-full py-3.5 text-base shadow-lg">
          {pendiente ? "Guardando…" : cambiado ? "Guardar cierre" : "Sin cambios"}
        </button>
        {mensaje && <p className={`mt-1 text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
      </div>
    </div>
  );
}

function CampoNota({ etiqueta, valor, sugerida, onChange }: { etiqueta: string; valor: number | null; sugerida?: number; onChange: (v: string) => void }) {
  return (
    <label>
      <span className="text-[11px] text-texto-2">{etiqueta}{sugerida !== undefined && valor === null && <> · sug. <b>{sugerida}</b></>}</span>
      <select value={valor ?? ""} onChange={(e) => onChange(e.target.value)} className="campo py-2">
        <option value="">–</option>
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}
