"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { TIPOS_EVENTO, type Repeticion, type TipoEvento } from "@/db/constantes";
import { NOMBRE_TIPO_EVENTO } from "@/lib/textos";
import { borrarEvento, cancelarOcurrencia, crearEvento } from "./acciones";

const REPETIR: { valor: Repeticion; texto: string }[] = [
  { valor: "ninguna", texto: "No se repite" },
  { valor: "semanal", texto: "Todas las semanas" },
  { valor: "quincenal", texto: "Cada dos semanas" },
  { valor: "mensual", texto: "Todos los meses" },
];

export function FormEvento({
  fechaInicial,
  hastaSugerido,
  materias,
  escuelas,
}: {
  fechaInicial: string;
  hastaSugerido: string;
  materias: { id: number; nombre: string }[];
  escuelas: { id: number; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoEvento>("examen");
  const [variosDias, setVariosDias] = useState(false);
  const [repeticion, setRepeticion] = useState<Repeticion>("ninguna");
  const form = useRef<HTMLFormElement>(null);
  const [estado, accion, pendiente] = useActionState(async (prev: Awaited<ReturnType<typeof crearEvento>>, datos: FormData) => {
    const r = await crearEvento(prev, datos);
    if (r?.ok) {
      setTipo("examen");
      setRepeticion("ninguna");
      setVariosDias(false);
      setAbierto(false);
    }
    return r;
  }, null);

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="boton-primario w-full py-3">
        + Agendar
      </button>
    );
  }

  return (
    <form ref={form} action={accion} className="tarjeta space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Nuevo evento</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-texto-2">Cancelar</button>
      </div>

      <input name="titulo" required placeholder="Título (ej. Examen de soluciones)" className="campo" autoFocus />

      <label className="block">
        <span className="etiqueta">Tipo</span>
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)} className="campo">
          {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{NOMBRE_TIPO_EVENTO[t]}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className={variosDias ? "" : "col-span-2"}>
          <span className="etiqueta">{variosDias ? "Desde" : "Fecha"}</span>
          <input type="date" name="fechaInicio" required defaultValue={fechaInicial} className="campo" />
        </label>
        {variosDias && (
          <label>
            <span className="etiqueta">Hasta</span>
            <input type="date" name="fechaFin" required className="campo" />
          </label>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={variosDias} onChange={(e) => setVariosDias(e.target.checked)} className="size-4 accent-[var(--tinta)]" />
        Dura varios días
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="etiqueta">Hora (opcional)</span>
          <input type="time" name="horaInicio" className="campo" />
        </label>
        <label>
          <span className="etiqueta">Hasta</span>
          <input type="time" name="horaFin" className="campo" />
        </label>
      </div>

      <label className="block">
        <span className="etiqueta">¿De qué curso o escuela?</span>
        <select name="asociado" defaultValue="" className="campo">
          <option value="">General</option>
          {materias.length > 0 && (
            <optgroup label="Materia">
              {materias.map((m) => <option key={m.id} value={`a:${m.id}`}>{m.nombre}</option>)}
            </optgroup>
          )}
          {escuelas.length > 0 && (
            <optgroup label="Escuela entera">
              {escuelas.map((e) => <option key={e.id} value={`e:${e.id}`}>{e.nombre}</option>)}
            </optgroup>
          )}
        </select>
      </label>

      <label className="block">
        <span className="etiqueta">Repetición</span>
        <select name="repeticion" value={repeticion} onChange={(e) => setRepeticion(e.target.value as Repeticion)} className="campo">
          {REPETIR.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
        </select>
      </label>
      {repeticion !== "ninguna" && (
        <label className="block">
          <span className="etiqueta">Repetir hasta</span>
          <input type="date" name="repetirHasta" required defaultValue={hastaSugerido} className="campo" />
        </label>
      )}

      <label className="block">
        <span className="etiqueta">Avisarme</span>
        <select name="avisarDiasAntes" defaultValue={tipo === "examen" || tipo === "cierre_notas" ? "1" : ""} key={tipo} className="campo">
          <option value="">Sin aviso</option>
          <option value="1">El día antes</option>
          <option value="2">Dos días antes</option>
          <option value="7">Una semana antes</option>
        </select>
      </label>

      <textarea name="nota" rows={2} placeholder="Nota (opcional)" className="campo" />

      {estado?.error && <p className="text-sm text-ausente">{estado.error}</p>}
      <button disabled={pendiente} className="boton-primario w-full py-3">{pendiente ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

export function AccionesEvento({ eventoId, fechaOriginal, repite }: { eventoId: number; fechaOriginal: string; repite: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="mt-2 flex gap-3 pl-[68px] text-xs font-semibold">
      {repite && (
        <button
          disabled={pendiente}
          onClick={() => confirm("¿Sacar solo esta fecha de la serie?") && iniciar(() => cancelarOcurrencia(eventoId, fechaOriginal))}
          className="text-texto-2"
        >
          Sacar esta fecha
        </button>
      )}
      <button
        disabled={pendiente}
        onClick={() => confirm(repite ? "¿Borrar todas las fechas de este evento?" : "¿Borrar este evento?") && iniciar(() => borrarEvento(eventoId))}
        className="text-ausente"
      >
        {repite ? "Borrar la serie" : "Borrar"}
      </button>
    </div>
  );
}
