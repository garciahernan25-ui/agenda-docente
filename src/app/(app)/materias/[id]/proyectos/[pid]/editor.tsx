"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BotonBorrar } from "@/components/boton-borrar";
import { TIPOS_PROYECTO, type TipoProyecto } from "@/db/constantes";
import type { ContenidoProyecto } from "@/db/schema";
import { ETIQUETA_LUGAR, NOMBRE_TIPO_PROYECTO, partesProyecto } from "@/lib/proyectos-textos";
import { borrarProyecto, guardarProyecto } from "../acciones";

type Proyecto = {
  id: number;
  tipo: TipoProyecto;
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  lugar: string;
  conNomina: boolean;
  agendado: boolean;
  contenido: ContenidoProyecto;
};

export function EditorProyecto({ asignacionId, proyecto, cantidadAlumnos }: { asignacionId: number; proyecto: Proyecto; cantidadAlumnos: number }) {
  const router = useRouter();
  const [p, setP] = useState(proyecto);
  const [agendar, setAgendar] = useState(proyecto.agendado || !proyecto.fecha);
  const [cambios, setCambios] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const partes = partesProyecto(p.tipo);

  function set<K extends keyof Proyecto>(k: K, v: Proyecto[K]) {
    setP((x) => ({ ...x, [k]: v }));
    setCambios(true);
    setMensaje(null);
  }
  function setTexto(k: keyof ContenidoProyecto, v: string) {
    setP((x) => ({ ...x, contenido: { ...x.contenido, [k]: v } }));
    setCambios(true);
    setMensaje(null);
  }

  function guardar() {
    iniciar(async () => {
      try {
        const r = await guardarProyecto({
          id: p.id,
          asignacionId,
          tipo: p.tipo,
          titulo: p.titulo,
          fecha: p.fecha,
          horaInicio: p.horaInicio,
          horaFin: p.horaFin,
          lugar: p.lugar,
          conNomina: p.conNomina,
          agendar,
          contenido: p.contenido,
        });
        setCambios(false);
        setMensaje({ ok: true, texto: r.agendado ? "Proyecto guardado y agendado en el calendario." : "Proyecto guardado." });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudo guardar. Revisá que tenga título y probá de nuevo." });
      }
    });
  }

  const deshabilitado = cambios ? "pointer-events-none opacity-50" : "";

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/imprimir/proyecto/${p.id}`} aria-disabled={cambios} className={`boton py-2.5 ${deshabilitado}`}>
          Ver / imprimir
        </Link>
        <a href={`/api/proyectos/${p.id}`} aria-disabled={cambios} className={`boton py-2.5 ${deshabilitado}`}>
          Descargar Word
        </a>
      </div>
      {cambios && <p className="-mt-2 text-center text-xs text-texto-2">Guardá los cambios para verlo o descargarlo.</p>}

      <section className="tarjeta space-y-3 p-4">
        <label className="block">
          <span className="etiqueta">Tipo</span>
          <select value={p.tipo} onChange={(e) => set("tipo", e.target.value as TipoProyecto)} className="campo">
            {TIPOS_PROYECTO.map((t) => (
              <option key={t} value={t}>{NOMBRE_TIPO_PROYECTO[t]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta">Título</span>
          <input value={p.titulo} onChange={(e) => set("titulo", e.target.value)} className="campo" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block">
            <span className="etiqueta">Fecha</span>
            <input type="date" value={p.fecha} onChange={(e) => set("fecha", e.target.value)} className="campo" />
          </label>
          <label className="block">
            <span className="etiqueta">Desde</span>
            <input type="time" value={p.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} className="campo" />
          </label>
          <label className="block">
            <span className="etiqueta">Hasta</span>
            <input type="time" value={p.horaFin} onChange={(e) => set("horaFin", e.target.value)} className="campo" />
          </label>
        </div>
        <label className="block">
          <span className="etiqueta">{ETIQUETA_LUGAR[p.tipo]}</span>
          <input value={p.lugar} onChange={(e) => set("lugar", e.target.value)} className="campo" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={agendar} onChange={(e) => { setAgendar(e.target.checked); setCambios(true); }} className="size-4" />
          Agendarlo en el calendario {p.fecha ? "" : "(cuando tenga fecha)"}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.conNomina} onChange={(e) => set("conNomina", e.target.checked)} className="size-4" />
          Agregar la nómina del curso al final ({cantidadAlumnos} estudiantes activos)
        </label>
      </section>

      {partes.map((parte) => (
        <label key={parte.clave} className="block">
          <span className="etiqueta">{parte.titulo}</span>
          <textarea
            value={p.contenido[parte.clave] ?? ""}
            onChange={(e) => setTexto(parte.clave, e.target.value)}
            className="campo min-h-24 [field-sizing:content]"
          />
          <span className="mt-1 block text-xs text-texto-2">{parte.ayuda}</span>
        </label>
      ))}

      <div className="pt-2 text-center">
        <BotonBorrar
          accion={borrarProyecto}
          campos={{ id: p.id, asignacionId }}
          texto="Borrar proyecto"
          aviso={`Se borra "${p.titulo}"${p.agendado ? " y su evento del calendario" : ""}.`}
        />
      </div>

      {(cambios || pendiente) && (
        <div className="sticky bottom-20 z-20">
          <button onClick={guardar} disabled={pendiente} className="boton-primario w-full py-3.5 text-base shadow-lg">
            {pendiente ? "Guardando…" : "Guardar proyecto"}
          </button>
        </div>
      )}
      {mensaje && <p className={`text-center text-sm ${mensaje.ok ? "text-presente" : "text-ausente"}`}>{mensaje.texto}</p>}
    </div>
  );
}
