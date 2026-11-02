// Nombres de cada parte del proyecto según el tipo (sirve en el celu, en la impresión y en el Word)
import type { ContenidoProyecto } from "@/db/schema";
import type { TipoProyecto } from "@/db/constantes";

export type ParteProyecto = { clave: keyof ContenidoProyecto; titulo: string; ayuda: string; lista?: boolean };

export const NOMBRE_TIPO_PROYECTO: Record<TipoProyecto, string> = {
  salida: "Salida educativa",
  laboratorio: "Práctica de laboratorio",
  otro: "Otro proyecto",
};

export const TITULO_DOCUMENTO: Record<TipoProyecto, string> = {
  salida: "Proyecto de salida educativa",
  laboratorio: "Proyecto de práctica de laboratorio",
  otro: "Proyecto",
};

export const ETIQUETA_LUGAR: Record<TipoProyecto, string> = {
  salida: "Lugar a visitar (nombre y dirección)",
  laboratorio: "Espacio (laboratorio, aula, patio…)",
  otro: "Lugar",
};

export function partesProyecto(tipo: TipoProyecto): ParteProyecto[] {
  const salida = tipo === "salida";
  const lab = tipo === "laboratorio";
  return [
    { clave: "responsables", titulo: salida ? "Docentes responsables y acompañantes" : "Docentes responsables", ayuda: "Uno por renglón, con el cargo si hace falta.", lista: true },
    { clave: "fundamentacion", titulo: "Fundamentación", ayuda: "Por qué esta actividad y cómo se relaciona con lo que vienen trabajando." },
    { clave: "objetivos", titulo: "Objetivos", ayuda: "Que los estudiantes logren… Uno por renglón.", lista: true },
    { clave: "contenidos", titulo: "Contenidos que se abordan", ayuda: "Uno por renglón.", lista: true },
    {
      clave: "antes",
      titulo: salida ? "Actividades previas a la salida" : lab ? "Actividades previas a la práctica" : "Actividades previas",
      ayuda: "Una por renglón.",
      lista: true,
    },
    {
      clave: "durante",
      titulo: salida ? "Actividades durante la salida" : lab ? "Desarrollo de la práctica (procedimiento)" : "Desarrollo",
      ayuda: lab ? "Los pasos, uno por renglón." : "Una por renglón.",
      lista: true,
    },
    {
      clave: "despues",
      titulo: salida ? "Actividades posteriores" : lab ? "Cierre y análisis de resultados" : "Cierre",
      ayuda: "Una por renglón.",
      lista: true,
    },
    { clave: "recursos", titulo: lab ? "Materiales, reactivos y equipos" : "Recursos y materiales", ayuda: "Uno por renglón.", lista: true },
    {
      clave: "logistica",
      titulo: salida ? "Itinerario y traslado" : lab ? "Normas de seguridad" : "Organización",
      ayuda: salida ? "Horario de salida y regreso, medio de transporte, recorrido. Uno por renglón." : lab ? "Una por renglón." : "Uno por renglón.",
      lista: true,
    },
    { clave: "evaluacion", titulo: "Evaluación", ayuda: "Cómo y con qué vas a evaluar. Uno por renglón.", lista: true },
    { clave: "observaciones", titulo: "Observaciones", ayuda: "Opcional." },
  ];
}

// Lo que conviene precargar en un proyecto nuevo para no arrancar de cero
export function plantillaProyecto(tipo: TipoProyecto, docente: string): ContenidoProyecto {
  if (tipo === "laboratorio") {
    return {
      responsables: docente,
      logistica: [
        "Uso de guardapolvo y, cuando corresponda, anteojos de seguridad y guantes.",
        "Pelo recogido y mesadas despejadas.",
        "No comer ni beber en el laboratorio.",
        "Manipular los materiales solo con indicación del docente.",
        "Lavarse las manos al terminar la práctica.",
      ].join("\n"),
    };
  }
  if (tipo === "salida") return { responsables: docente, logistica: "Salida de la escuela: \nRegreso a la escuela: \nMedio de transporte: " };
  return { responsables: docente };
}
