import type { Categoria, TipoEvento } from "@/db/schema";

// Nombres de los tipos de evaluación de base (cada materia puede renombrarlos)
export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  participacion: "Participación",
  desempeno: "Desempeño en clase",
  tp_escrito: "TP escrito",
  actividad_virtual: "Actividad virtual",
  oral: "Respuesta oral",
  quiz: "Quiz",
  examen: "Examen",
};

export const NOMBRE_TIPO_EVENTO: Record<TipoEvento, string> = {
  examen: "Examen",
  feria: "Feria de ciencias",
  cierre_notas: "Cierre de notas",
  intensificacion: "Intensificación",
  valoracion_preliminar: "Valoración preliminar",
  reunion: "Reunión",
  acto: "Acto",
  salida: "Salida educativa",
  sin_clases: "Sin clases",
  otro: "Otro",
};

// clases de color (Tailwind) por tipo de evento
export const COLOR_TIPO_EVENTO: Record<TipoEvento, string> = {
  examen: "bg-ausente-bg text-ausente",
  feria: "bg-presente-bg text-presente",
  cierre_notas: "bg-tinta-suave text-tinta",
  intensificacion: "bg-tarde-bg text-tarde",
  valoracion_preliminar: "bg-tinta-suave text-tinta",
  reunion: "bg-justif-bg text-justif",
  acto: "bg-justif-bg text-justif",
  salida: "bg-presente-bg text-presente",
  sin_clases: "bg-justif-bg text-justif",
  otro: "bg-justif-bg text-justif",
};

export const PUNTO_TIPO_EVENTO: Record<TipoEvento, string> = {
  examen: "bg-ausente",
  feria: "bg-presente",
  cierre_notas: "bg-tinta",
  intensificacion: "bg-tarde",
  valoracion_preliminar: "bg-tinta",
  reunion: "bg-justif",
  salida: "bg-presente",
  acto: "bg-justif",
  sin_clases: "bg-justif",
  otro: "bg-justif",
};
