"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarVinculos, traerNotas } from "./acciones";

type Estudiante = {
  inscripcionId: number;
  apellidoNombre: string;
  baja: boolean;
  quizAlumnoId: string | null;
  nombreEnQuizzes: string | null;
  sugerido: string | null;
};
type Cambio = { inscripcionId: number; tema: string; valor: number; antes: number | null };

export function PanelQuizzes({
  asignacionId,
  estudiantes,
  candidatos,
  cambios,
  hayTemasConQuiz,
}: {
  asignacionId: number;
  estudiantes: Estudiante[];
  candidatos: { id: string; texto: string }[];
  cambios: Cambio[];
  hayTemasConQuiz: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const sinVincular = estudiantes.filter((e) => !e.quizAlumnoId);
  // Arranca con las sugerencias puestas; vos confirmás
  const [eleccion, setEleccion] = useState<Record<number, string>>(() =>
    Object.fromEntries(sinVincular.map((e) => [e.inscripcionId, e.sugerido ?? ""])),
  );
  const [editando, setEditando] = useState(false);
  const nombre = new Map(estudiantes.map((e) => [e.inscripcionId, e.apellidoNombre]));
  const usados = new Set(Object.values(eleccion).filter(Boolean));

  function guardar(pares: { inscripcionId: number; quizAlumnoId: string | null }[]) {
    iniciar(async () => {
      try {
        await guardarVinculos({ asignacionId, pares });
        setMensaje({ ok: true, texto: "Vínculos guardados." });
        setEditando(false);
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudieron guardar los vínculos." });
      }
    });
  }

  function traer() {
    iniciar(async () => {
      const r = await traerNotas(asignacionId);
      if (!r.ok) {
        setMensaje({ ok: false, texto: "No se pudo leer la página de quizzes. Probá de nuevo." });
        return;
      }
      setMensaje({
        ok: true,
        texto: r.nuevas + r.actualizadas ? `Listo: ${r.nuevas} notas nuevas y ${r.actualizadas} actualizadas.` : "Ya estaba todo al día.",
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <h2 className="titulo-seccion">Estudiantes en la página de quizzes</h2>

      {sinVincular.length > 0 && hayTemasConQuiz && (
        <div className="tarjeta space-y-2 p-3">
          <p className="text-sm">
            Elegí quién es cada uno en quizzes. Te dejé puesto el que más se parece por nombre; revisalo y guardá. Esto se hace una sola vez.
          </p>
          <ul className="divide-y divide-borde">
            {sinVincular.map((e) => (
              <li key={e.inscripcionId} className="py-2">
                <p className={`text-sm font-medium ${e.baja ? "text-texto-2" : ""}`}>{e.apellidoNombre}</p>
                <select
                  value={eleccion[e.inscripcionId] ?? ""}
                  onChange={(ev) => setEleccion((s) => ({ ...s, [e.inscripcionId]: ev.target.value }))}
                  className="campo mt-1 py-2 text-sm"
                  aria-label={`Quién es ${e.apellidoNombre} en quizzes`}
                >
                  <option value="">No lo encuentro / no hace quizzes</option>
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id} disabled={usados.has(c.id) && eleccion[e.inscripcionId] !== c.id}>
                      {c.texto}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <button
            onClick={() =>
              guardar(
                Object.entries(eleccion)
                  .filter(([, v]) => v)
                  .map(([k, v]) => ({ inscripcionId: Number(k), quizAlumnoId: v })),
              )
            }
            disabled={pendiente || !Object.values(eleccion).some(Boolean)}
            className="boton-primario w-full disabled:opacity-50"
          >
            Guardar vínculos
          </button>
        </div>
      )}

      {estudiantes.some((e) => e.quizAlumnoId) && (
        <details className="tarjeta p-3 text-sm" open={editando} onToggle={(ev) => setEditando((ev.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer font-semibold">
            Ya vinculados ({estudiantes.filter((e) => e.quizAlumnoId).length})
          </summary>
          <ul className="mt-2 divide-y divide-borde">
            {estudiantes
              .filter((e) => e.quizAlumnoId)
              .map((e) => (
                <li key={e.inscripcionId} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1">
                    {e.apellidoNombre} <span className="text-texto-2">→ {e.nombreEnQuizzes}</span>
                  </span>
                  <button
                    onClick={() => guardar([{ inscripcionId: e.inscripcionId, quizAlumnoId: null }])}
                    disabled={pendiente}
                    className="text-xs font-semibold text-ausente"
                  >
                    Desvincular
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}

      <h2 className="titulo-seccion">Notas para traer</h2>
      {cambios.length === 0 ? (
        <p className="tarjeta p-4 text-sm text-texto-2">
          {estudiantes.some((e) => e.quizAlumnoId) ? "No hay notas nuevas. Todo al día." : "Primero vinculá a los estudiantes."}
        </p>
      ) : (
        <div className="tarjeta p-3">
          <ul className="max-h-72 divide-y divide-borde overflow-y-auto text-sm">
            {cambios.map((c, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate">
                  {nombre.get(c.inscripcionId)} <span className="text-texto-2">· {c.tema}</span>
                </span>
                {c.antes !== null && <span className="text-xs text-texto-2 line-through">{c.antes}</span>}
                <span className="font-semibold">{c.valor}</span>
              </li>
            ))}
          </ul>
          <button onClick={traer} disabled={pendiente} className="boton-primario mt-3 w-full">
            {pendiente ? "Trayendo…" : `Traer ${cambios.length} ${cambios.length === 1 ? "nota" : "notas"} a la columna Quiz`}
          </button>
        </div>
      )}
      <p className="text-xs text-texto-2">
        Cuenta la misma nota que ves en quizzes (la mejor del estudiante o la que corregiste a mano). Si después cambia allá, acá se actualiza al volver a traer. Las notas de quiz que cargaste a mano no se tocan.
      </p>
      {mensaje && <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
    </div>
  );
}
