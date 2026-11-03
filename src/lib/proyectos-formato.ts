// Lo que muestran igual la impresión y el Word de un proyecto
import type { DatosProyecto } from "./proyectos";
import { fechaLarga } from "./fechas";
import { partesProyecto, TITULO_DOCUMENTO } from "./proyectos-textos";
import { grupoDe } from "@/lib/grupo";

export function renglonesProyecto(texto: string | undefined): string[] {
  return (texto ?? "")
    .split(/\r?\n/)
    .map((r) => r.replace(/^\s*[●•\-–*]\s*/, "").trim())
    .filter(Boolean);
}

export function armarProyecto(d: DatosProyecto) {
  const { p, cab, nomina } = d;
  const eps = cab.modalidad.formato === "eps";
  const horario = p.horaInicio ? `${p.horaInicio}${p.horaFin ? ` a ${p.horaFin}` : ""} h` : "";
  return {
    escuela: cab.escuela.nombre,
    distrito: cab.escuela.distrito ?? "",
    documento: TITULO_DOCUMENTO[p.tipo],
    titulo: p.titulo,
    datos: [
      ["Docente", cab.asig.profesor],
      ["Espacio curricular", cab.asig.materia],
      ["Curso y turno", `${grupoDe(cab)} · ${cab.div.turno}`],
      ["Estudiantes", String(nomina.length)],
      ["Fecha", p.fecha ? fechaLarga(p.fecha) : ""],
      ["Horario", horario],
      [p.tipo === "laboratorio" ? "Espacio" : "Lugar", p.lugar ?? ""],
      ["Ciclo lectivo", String(cab.curso.cicloLectivo)],
    ] as [string, string][],
    partes: partesProyecto(p.tipo)
      .map((parte) => ({
        titulo: parte.titulo,
        lista: !!parte.lista,
        items: parte.lista ? renglonesProyecto(p.contenido[parte.clave]) : [],
        parrafos: parte.lista ? [] : (p.contenido[parte.clave] ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
      }))
      .filter((x) => x.items.length || x.parrafos.length),
    nomina: p.conNomina ? nomina : [],
    responsables: renglonesProyecto(p.contenido.responsables),
  };
}

export type ProyectoArmado = ReturnType<typeof armarProyecto>;
