// Constantes compartidas entre servidor y cliente (sin dependencias de la base)
// Secundaria común: planilla de calificaciones DGCyE. EPS: RITE por área + Plan de trabajo formativo
export const FORMATOS = ["secundaria", "eps"] as const;
export type Formato = (typeof FORMATOS)[number];

export const NIVELES_EPS = [1, 2, 3, 4] as const;

export const TURNOS = ["Mañana", "Tarde", "Vespertino", "Noche"] as const;

export const CATEGORIAS = [
  "participacion",
  "desempeno",
  "tp_escrito",
  "actividad_virtual",
  "oral",
  "quiz",
  "examen",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ESTADOS_ASISTENCIA = ["P", "A", "T", "J"] as const;
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];

export const VALORACIONES = ["TEA", "TEP", "TED"] as const;
export type Valoracion = (typeof VALORACIONES)[number];

export const TIPOS_EVENTO = [
  "examen",
  "feria",
  "cierre_notas",
  "intensificacion",
  "valoracion_preliminar",
  "reunion",
  "acto",
  "salida", // salida educativa
  "sin_clases", // paro, jornada, feriado: las clases de ese día quedan como no dictadas
  "otro",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const REPETICIONES = ["ninguna", "semanal", "quincenal", "mensual"] as const;
export type Repeticion = (typeof REPETICIONES)[number];


// Proyectos que pide la escuela para salir o usar el laboratorio
export const TIPOS_PROYECTO = ["salida", "laboratorio", "otro"] as const;
export type TipoProyecto = (typeof TIPOS_PROYECTO)[number];
