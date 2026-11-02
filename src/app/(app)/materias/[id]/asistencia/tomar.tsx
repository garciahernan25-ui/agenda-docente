"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import type { EstadoAsistencia } from "@/db/schema";
import { resumenAsistencia } from "@/lib/calculos";
import { fechaCortaMayus } from "@/lib/fechas";
import { guardarAsistencia } from "../acciones";

type Alumno = {
  inscripcionId: number;
  orden: number;
  nombre: string;
  baja: boolean;
  estado: EstadoAsistencia | null;
};

const SIGUIENTE: Record<EstadoAsistencia, EstadoAsistencia> = { P: "A", A: "T", T: "J", J: "P" };
const ESTILO: Record<EstadoAsistencia, string> = {
  P: "bg-presente-bg text-presente",
  A: "bg-ausente-bg text-ausente",
  T: "bg-tarde-bg text-tarde",
  J: "bg-justif-bg text-justif",
};
const NOMBRE: Record<EstadoAsistencia, string> = { P: "Presente", A: "Ausente", T: "Tarde", J: "Justificada" };

export function TomarAsistencia(props: {
  asignacionId: number;
  fecha: string;
  hoy: string;
  yaCargada: boolean;
  dictadaInicial: boolean;
  avisoSinClases: string | null;
  temaInicial: number | null;
  temas: { id: number; titulo: string }[];
  alumnos: Alumno[];
  recientes: { fecha: string; dictada: boolean }[];
}) {
  const router = useRouter();
  const activos = props.alumnos.filter((a) => !a.baja);
  // Clase nueva: todos presentes, y vas tocando a los que faltan
  const [estados, setEstados] = useState<Record<number, EstadoAsistencia>>(() =>
    Object.fromEntries(activos.map((a) => [a.inscripcionId, a.estado ?? "P"])),
  );
  const [dictada, setDictada] = useState(props.dictadaInicial);
  const [tema, setTema] = useState<number | null>(props.temaInicial);
  const [guardado, setGuardado] = useState<"no" | "si" | "error">(props.yaCargada ? "si" : "no");
  const [pendiente, iniciar] = useTransition();

  const conteo = useMemo(() => resumenAsistencia(Object.values(estados)), [estados]);

  function cambiar(id: number, e?: EstadoAsistencia) {
    setEstados((s) => ({ ...s, [id]: e ?? SIGUIENTE[s[id]] }));
    setGuardado("no");
  }

  function guardar() {
    iniciar(async () => {
      try {
        await guardarAsistencia({
          asignacionId: props.asignacionId,
          fecha: props.fecha,
          dictada,
          temaId: tema,
          registros: Object.entries(estados).map(([id, estado]) => ({ inscripcionId: Number(id), estado })),
        });
        setGuardado("si");
        router.refresh();
      } catch {
        setGuardado("error");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="tarjeta flex items-center gap-2 p-3">
        <input
          type="date"
          value={props.fecha}
          max={props.hoy}
          onChange={(e) => e.target.value && router.push(`?fecha=${e.target.value}`)}
          className="campo flex-1"
          aria-label="Fecha de la clase"
        />
        {props.fecha !== props.hoy && (
          <Link href="?" className="boton shrink-0">Hoy</Link>
        )}
      </div>

      {props.avisoSinClases && (
        <p className="rounded-xl bg-justif-bg px-3 py-2 text-sm text-justif">
          En el calendario figura “{props.avisoSinClases}” para este día.
        </p>
      )}

      <label className="flex items-center justify-between rounded-xl border border-borde bg-hoja px-4 py-3 text-sm font-medium">
        Hubo clase este día
        <input type="checkbox" checked={dictada} onChange={(e) => { setDictada(e.target.checked); setGuardado("no"); }} className="size-5 accent-[var(--tinta)]" />
      </label>

      {dictada && (
        <>
          {props.temas.length > 0 && (
            <select
              value={tema ?? ""}
              onChange={(e) => { setTema(e.target.value ? Number(e.target.value) : null); setGuardado("no"); }}
              className="campo"
              aria-label="Tema de la clase"
            >
              <option value="">Tema de la clase (opcional)</option>
              {props.temas.map((t) => (
                <option key={t.id} value={t.id}>{t.titulo}</option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="rounded-md bg-presente-bg px-2 py-1 text-presente">{conteo.presentes} P</span>
            <span className="rounded-md bg-ausente-bg px-2 py-1 text-ausente">{conteo.ausentes} A</span>
            <span className="rounded-md bg-tarde-bg px-2 py-1 text-tarde">{conteo.tardes} T</span>
            <span className="rounded-md bg-justif-bg px-2 py-1 text-justif">{conteo.justificadas} J</span>
            <span className="ml-auto self-center font-normal text-texto-2">Tocá para cambiar · mantené para elegir</span>
          </div>

          <ul className="tarjeta divide-y divide-borde overflow-hidden">
            {activos.map((a) => (
              <FilaAlumno key={a.inscripcionId} alumno={a} estado={estados[a.inscripcionId]} onCambiar={cambiar} />
            ))}
            {activos.length === 0 && <li className="px-4 py-3 text-sm text-texto-2">No hay alumnos activos.</li>}
          </ul>
        </>
      )}

      <div className="sticky bottom-20 z-10">
        <button onClick={guardar} disabled={pendiente} className="boton-primario w-full py-3.5 text-base shadow-lg">
          {pendiente ? "Guardando…" : guardado === "si" ? "Guardado ✓" : props.yaCargada ? "Guardar cambios" : "Guardar asistencia"}
        </button>
        {guardado === "error" && <p className="mt-1 text-center text-sm text-ausente">No se pudo guardar. Probá de nuevo.</p>}
      </div>

      {props.recientes.length > 0 && (
        <section>
          <h2 className="titulo-seccion">Últimas clases</h2>
          <div className="flex flex-wrap gap-2">
            {props.recientes.map((r) => (
              <Link
                key={r.fecha}
                href={`?fecha=${r.fecha}`}
                className={`rounded-lg border px-2.5 py-1 text-xs ${r.fecha === props.fecha ? "border-tinta text-tinta" : "border-borde text-texto-2"} ${r.dictada ? "" : "line-through"}`}
              >
                {fechaCortaMayus(r.fecha)}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FilaAlumno({
  alumno,
  estado,
  onCambiar,
}: {
  alumno: Alumno;
  estado: EstadoAsistencia;
  onCambiar: (id: number, e?: EstadoAsistencia) => void;
}) {
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const largo = useRef(false);

  return (
    <li className="relative">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-papel"
        onPointerDown={() => {
          largo.current = false;
          timer.current = setTimeout(() => { largo.current = true; setMenu(true); }, 450);
        }}
        onPointerUp={() => clearTimeout(timer.current)}
        onPointerLeave={() => clearTimeout(timer.current)}
        onClick={() => { if (!largo.current) onCambiar(alumno.inscripcionId); }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`${alumno.nombre}: ${NOMBRE[estado]}`}
      >
        <span className="w-5 text-right text-xs tabular-nums text-texto-2">{alumno.orden}</span>
        <span className="flex-1 text-[15px]">{alumno.nombre}</span>
        <span className={`grid size-9 place-items-center rounded-lg text-sm font-bold ${ESTILO[estado]}`}>{estado}</span>
      </button>
      {menu && (
        <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 gap-1 rounded-xl border border-borde bg-hoja p-1 shadow-lg">
          {(["P", "A", "T", "J"] as const).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onCambiar(alumno.inscripcionId, e); setMenu(false); }}
              className={`grid size-9 place-items-center rounded-lg text-sm font-bold ${ESTILO[e]}`}
              aria-label={NOMBRE[e]}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
