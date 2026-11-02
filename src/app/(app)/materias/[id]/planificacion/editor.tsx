"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PlanificacionAnual } from "@/db/schema";
import type { UnidadPlan } from "@/lib/planificacion";
import { copiarPlanificacion, crearTemasDesdeUnidades, guardarPlanificacion } from "./acciones";

type Datos = { escuela: string; docente: string; curso: string; turno: string; materia: string; ciclo: number };
type Clave = keyof PlanificacionAnual;

// Mismo orden y nombres que el modelo de planificación
const BLOQUE_INICIO: { clave: Clave; titulo: string; ayuda: string; lista?: boolean }[] = [
  { clave: "fundamentacion", titulo: "Fundamentación", ayuda: "Texto corrido. Dejá un renglón en blanco entre párrafos." },
  { clave: "objetivosEnsenanza", titulo: "Objetivos de enseñanza", ayuda: "Se espera que el docente pueda… Uno por renglón." },
  { clave: "objetivosAprendizaje", titulo: "Objetivos de aprendizaje", ayuda: "Se espera que el estudiante logre… Uno por renglón." },
];
const BLOQUE_FINAL: { clave: Clave; titulo: string; ayuda: string; lista?: boolean }[] = [
  { clave: "estrategias", titulo: "Estrategias didácticas. Actividades", ayuda: "Una por renglón." },
  { clave: "recursos", titulo: "Recursos", ayuda: "Uno por renglón." },
  { clave: "sistemaEvaluativo", titulo: "Sistema evaluativo", ayuda: "Instrumentos, uno por renglón." },
  { clave: "criterios", titulo: "Criterios de evaluación", ayuda: "Uno por renglón." },
  { clave: "bibliografiaDocente", titulo: "Bibliografía para el docente", ayuda: "Una obra por renglón." },
  { clave: "bibliografiaEstudiante", titulo: "Bibliografía para el estudiante", ayuda: "Una obra por renglón." },
  { clave: "proyectos", titulo: "Proyectos institucionales / Salidas educativas", ayuda: "Uno por renglón." },
  { clave: "observaciones", titulo: "Observaciones", ayuda: "Una por renglón." },
];

const UNIDAD_VACIA = (c: 1 | 2): UnidadPlan => ({ cuatrimestre: c, titulo: "", eje: "", contenidos: "" });

export function EditorPlanificacion({
  asignacionId,
  datos,
  contenido: inicial,
  unidades: unidadesIniciales,
  otras,
}: {
  asignacionId: number;
  datos: Datos;
  contenido: PlanificacionAnual;
  unidades: UnidadPlan[];
  otras: { id: number; texto: string }[];
}) {
  const router = useRouter();
  const [contenido, setContenido] = useState<PlanificacionAnual>(inicial);
  const [unidades, setUnidades] = useState<UnidadPlan[]>(unidadesIniciales);
  const [cambios, setCambios] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const vacia = !unidadesIniciales.length && !Object.values(inicial).some(Boolean);

  function set(clave: Clave, v: string) {
    setContenido((c) => ({ ...c, [clave]: v }));
    setCambios(true);
    setMensaje(null);
  }

  function cambiarUnidad(i: number, campo: "titulo" | "eje" | "contenidos", v: string) {
    setUnidades((us) => us.map((u, j) => (j === i ? { ...u, [campo]: v } : u)));
    setCambios(true);
    setMensaje(null);
  }

  function mover(i: number, paso: -1 | 1) {
    setUnidades((us) => {
      const j = i + paso;
      if (j < 0 || j >= us.length || us[j].cuatrimestre !== us[i].cuatrimestre) return us;
      const copia = [...us];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
    setCambios(true);
  }

  function pasar(i: number) {
    setUnidades((us) => {
      const u = us[i];
      const destino: 1 | 2 = u.cuatrimestre === 1 ? 2 : 1;
      const resto = us.filter((_, j) => j !== i);
      const movida = { ...u, cuatrimestre: destino };
      // al 2°: queda primera del 2°; al 1°: queda última del 1°
      const pos = destino === 2 ? resto.findIndex((x) => x.cuatrimestre === 2) : resto.map((x) => x.cuatrimestre).lastIndexOf(1) + 1;
      const p = pos === -1 ? resto.length : pos;
      return [...resto.slice(0, p), movida, ...resto.slice(p)];
    });
    setCambios(true);
  }

  function quitar(i: number) {
    setUnidades((us) => us.filter((_, j) => j !== i));
    setCambios(true);
  }

  function agregar(c: 1 | 2) {
    setUnidades((us) => {
      // queda al final de su cuatrimestre
      const ultimo = us.map((u) => u.cuatrimestre).lastIndexOf(c);
      const pos = ultimo === -1 ? (c === 1 ? 0 : us.length) : ultimo + 1;
      return [...us.slice(0, pos), UNIDAD_VACIA(c), ...us.slice(pos)];
    });
    setCambios(true);
  }

  function guardar() {
    iniciar(async () => {
      try {
        await guardarPlanificacion({ asignacionId, contenido, unidades });
        setCambios(false);
        setMensaje({ ok: true, texto: "Planificación guardada." });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  function crearTemas() {
    iniciar(async () => {
      try {
        const r = await crearTemasDesdeUnidades(asignacionId);
        setMensaje({
          ok: true,
          texto: r.creados
            ? `Listo, ${r.creados === 1 ? "se creó 1 tema" : `se crearon ${r.creados} temas`} para cargar notas.${r.yaEstaban ? ` ${r.yaEstaban} ya estaban.` : ""}`
            : "Todas las unidades ya tenían su tema.",
        });
      } catch {
        setMensaje({ ok: false, texto: "No se pudieron crear los temas." });
      }
    });
  }

  function copiar(desde: number) {
    iniciar(async () => {
      const r = await copiarPlanificacion(desde, asignacionId);
      if (!r.ok) {
        setMensaje({ ok: false, texto: "Esa materia todavía no tiene planificación." });
        return;
      }
      // recarga entera para traer lo copiado al formulario
      window.location.reload();
    });
  }

  // Numeración seguida en todo el año, en el orden en que se muestran
  const numeros = new Map<number, number>();
  for (const c of [1, 2]) unidades.forEach((u, i) => u.cuatrimestre === c && numeros.set(i, numeros.size + 1));

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/imprimir/planificacion/${asignacionId}`}
          aria-disabled={cambios}
          className={`boton py-2.5 ${cambios ? "pointer-events-none opacity-50" : ""}`}
        >
          Ver / imprimir
        </Link>
        <a
          href={`/api/asignaciones/${asignacionId}/planificacion`}
          aria-disabled={cambios}
          className={`boton py-2.5 ${cambios ? "pointer-events-none opacity-50" : ""}`}
        >
          Descargar Word
        </a>
      </div>
      {cambios && <p className="-mt-2 text-center text-xs text-texto-2">Guardá los cambios para verla o descargarla.</p>}

      {vacia && otras.length > 0 && (
        <label className="tarjeta block p-3">
          <span className="etiqueta">¿Ya planificaste esta materia en otro curso? Traela de ahí</span>
          <select defaultValue="" onChange={(e) => e.target.value && copiar(Number(e.target.value))} className="campo" disabled={pendiente}>
            <option value="">Elegí la materia…</option>
            {otras.map((o) => (
              <option key={o.id} value={o.id}>{o.texto}</option>
            ))}
          </select>
        </label>
      )}

      <section className="tarjeta p-4 text-sm">
        <p className="font-semibold">{datos.escuela}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-texto-2">
          <dt>Docente</dt><dd className="text-texto">{datos.docente}</dd>
          <dt>Curso</dt><dd className="text-texto">{datos.curso}</dd>
          <dt>Turno</dt><dd className="text-texto">{datos.turno}</dd>
          <dt>Espacio curricular</dt><dd className="text-texto">{datos.materia}</dd>
          <dt>Ciclo lectivo</dt><dd className="text-texto">{datos.ciclo}</dd>
        </dl>
        <label className="mt-3 block">
          <span className="etiqueta">Carga horaria</span>
          <input value={contenido.cargaHoraria ?? ""} onChange={(e) => set("cargaHoraria", e.target.value)} placeholder="2 módulos semanales" className="campo" />
        </label>
        <p className="mt-2 text-xs text-texto-2">Docente, curso y turno salen de Cursos. Si algo está mal, cambialo ahí.</p>
      </section>

      {BLOQUE_INICIO.map((b) => (
        <CampoTexto key={b.clave} titulo={b.titulo} ayuda={b.ayuda} valor={contenido[b.clave] ?? ""} onChange={(v) => set(b.clave, v)} />
      ))}

      <h2 className="titulo-seccion">Contenidos por unidad</h2>
      {([1, 2] as const).map((c) => (
        <section key={c} className="space-y-2">
          <p className="text-sm font-semibold">{c === 1 ? "Primer" : "Segundo"} cuatrimestre</p>
          {unidades.map((u, i) => {
            if (u.cuatrimestre !== c) return null;
            const numero = numeros.get(i);
            return (
              <div key={i} className="tarjeta space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-texto-2">Unidad n°{numero}</span>
                  <span className="flex gap-3 text-sm font-semibold">
                    <button type="button" onClick={() => mover(i, -1)} className="text-texto-2" aria-label="Subir">↑</button>
                    <button type="button" onClick={() => mover(i, 1)} className="text-texto-2" aria-label="Bajar">↓</button>
                    <button
                      type="button"
                      onClick={() => pasar(i)}
                      className="text-xs text-tinta"
                    >
                      Pasar al {c === 1 ? "2°" : "1°"}
                    </button>
                    <button type="button" onClick={() => quitar(i)} className="text-xs text-ausente">Quitar</button>
                  </span>
                </div>
                <input
                  value={u.titulo}
                  onChange={(e) => cambiarUnidad(i, "titulo", e.target.value)}
                  placeholder="Nombre de la unidad (Energía mecánica)"
                  className="campo font-semibold"
                  aria-label={`Nombre de la unidad ${numero}`}
                />
                <input
                  value={u.eje}
                  onChange={(e) => cambiarUnidad(i, "eje", e.target.value)}
                  placeholder="Eje temático (opcional)"
                  className="campo"
                  aria-label={`Eje de la unidad ${numero}`}
                />
                <textarea
                  value={u.contenidos}
                  onChange={(e) => cambiarUnidad(i, "contenidos", e.target.value)}
                  placeholder="Contenidos de la unidad"
                  className="campo min-h-24 [field-sizing:content]"
                  aria-label={`Contenidos de la unidad ${numero}`}
                />
              </div>
            );
          })}
          <button type="button" onClick={() => agregar(c)} className="text-sm font-semibold text-tinta">
            + Unidad en el {c}° cuatrimestre
          </button>
        </section>
      ))}

      {unidadesIniciales.length > 0 && (
        <div className="tarjeta p-3 text-sm">
          <p className="text-texto-2">
            Cada unidad puede ser un tema de la planilla de notas, con el mismo nombre. Si el quiz se llama igual, la nota va a caer ahí.
          </p>
          <button type="button" onClick={crearTemas} disabled={pendiente || cambios} className="boton mt-2 w-full disabled:opacity-50">
            Crear los temas desde las unidades
          </button>
        </div>
      )}

      {BLOQUE_FINAL.map((b) => (
        <CampoTexto key={b.clave} titulo={b.titulo} ayuda={b.ayuda} valor={contenido[b.clave] ?? ""} onChange={(v) => set(b.clave, v)} />
      ))}

      <label className="block">
        <span className="etiqueta">Fecha de entrega</span>
        <input type="date" value={contenido.fechaEntrega ?? ""} onChange={(e) => set("fechaEntrega", e.target.value)} className="campo" />
      </label>

      {(cambios || pendiente) && (
        <div className="sticky bottom-20 z-20">
          <button onClick={guardar} disabled={pendiente} className="boton-primario w-full py-3.5 text-base shadow-lg">
            {pendiente ? "Guardando…" : "Guardar planificación"}
          </button>
        </div>
      )}
      {mensaje && <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
    </div>
  );
}

function CampoTexto({
  titulo,
  ayuda,
  valor,
  onChange,
}: {
  titulo: string;
  ayuda: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="etiqueta">{titulo}</span>
      <textarea value={valor} onChange={(e) => onChange(e.target.value)} className="campo min-h-24 [field-sizing:content]" />
      <span className="mt-1 block text-xs text-texto-2">{ayuda}</span>
    </label>
  );
}
