import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  FORMATOS,
  TURNOS,
  CATEGORIAS,
  ESTADOS_ASISTENCIA,
  VALORACIONES,
  TIPOS_EVENTO,
  REPETICIONES,
  TIPOS_PROYECTO,
} from "./constantes";

export * from "./constantes";

export type DatosEps = {
  region?: string;
  familiaProfesional?: string;
  area?: string;
  correo?: string;
  oferta?: string;
  sede?: string;
  cfp?: string;
};

export type InformeContextual = {
  capacidades?: string;
  actividades?: string;
  dificultades?: string;
  observaciones?: string;
};

/*
 * Jerarquía: Modalidad › Escuela › Curso (año) › División (sección + turno)
 * Dentro de cada división: los alumnos (inscripciones) y las materias que das (asignaciones).
 * Una planilla de calificaciones = una asignación (materia en una división).
 */

const id = () => integer("id").primaryKey({ autoIncrement: true });
const creado = () =>
  text("creado_en").notNull().default(sql`(CURRENT_TIMESTAMP)`);

export const modalidades = sqliteTable("modalidades", {
  id: id(),
  nombre: text("nombre").notNull().unique(), // Secundaria, Técnica, Agraria, Superior...
  // Qué planillas usa: la de calificaciones común de secundaria, o RITE + Plan formativo de la EPS
  formato: text("formato", { enum: FORMATOS }).notNull().default("secundaria"),
  creadoEn: creado(),
});

export const escuelas = sqliteTable("escuelas", {
  id: id(),
  modalidadId: integer("modalidad_id")
    .notNull()
    .references(() => modalidades.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(), // "EES N° 52"
  distrito: text("distrito"),
  creadoEn: creado(),
});

export const cursos = sqliteTable("cursos", {
  id: id(),
  escuelaId: integer("escuela_id")
    .notNull()
    .references(() => escuelas.id, { onDelete: "cascade" }),
  anio: text("anio").notNull(), // "2°"
  cicloLectivo: integer("ciclo_lectivo").notNull(), // 2026
  creadoEn: creado(),
});


export const divisiones = sqliteTable("divisiones", {
  id: id(),
  cursoId: integer("curso_id")
    .notNull()
    .references(() => cursos.id, { onDelete: "cascade" }),
  seccion: text("seccion").notNull(), // "C"
  turno: text("turno", { enum: TURNOS }).notNull(),
  preceptor: text("preceptor"),
  creadoEn: creado(),
});

export const alumnos = sqliteTable("alumnos", {
  id: id(),
  apellido: text("apellido").notNull(),
  nombre: text("nombre").notNull(),
  dni: text("dni"),
  // id del alumno en quizzes-profe-nacho, para traer sus puntajes
  quizAlumnoId: text("quiz_alumno_id"),
  creadoEn: creado(),
});

export const inscripciones = sqliteTable(
  "inscripciones",
  {
    id: id(),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisiones.id, { onDelete: "cascade" }),
    alumnoId: integer("alumno_id")
      .notNull()
      .references(() => alumnos.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(), // N° de orden en la planilla
    cursaRecursa: text("cursa_recursa", { enum: ["C", "R"] })
      .notNull()
      .default("C"),
    // La planilla oficial prohíbe tachar: una baja sigue impresa en su fila
    estado: text("estado", { enum: ["activo", "baja"] })
      .notNull()
      .default("activo"),
    observacion: text("observacion"), // ej. "T.M" (pase de turno)
    // EPS: se trabaja por niveles (1 a 4), cada estudiante en el suyo
    nivel: integer("nivel"),
    inicioEps: text("inicio_eps"), // mes y año en que empezó a cursar la EPS, ej. "03/2025"
    creadoEn: creado(),
  },
  (t) => [
    uniqueIndex("insc_div_alumno").on(t.divisionId, t.alumnoId),
    uniqueIndex("insc_div_orden").on(t.divisionId, t.orden),
  ],
);

export const asignaciones = sqliteTable("asignaciones", {
  id: id(),
  divisionId: integer("division_id")
    .notNull()
    .references(() => divisiones.id, { onDelete: "cascade" }),
  materia: text("materia").notNull(), // "Fisicoquímica"
  profesor: text("profesor").notNull(),
  // Clases previstas por cuatrimestre (cuadro "Total de clases de la materia")
  totalClases1: integer("total_clases_1"),
  totalClases2: integer("total_clases_2"),
  // EPS: encabezado del RITE y del Plan formativo, e informe contextual (JSON)
  datosEps: text("datos_eps", { mode: "json" }).$type<DatosEps>(),
  informeContextual: text("informe_contextual", { mode: "json" }).$type<InformeContextual>(),
  creadoEn: creado(),
});


// Peso de cada categoría en la calificación del cuatrimestre, por asignación
export const pesos = sqliteTable(
  "pesos",
  {
    asignacionId: integer("asignacion_id")
      .notNull()
      .references(() => asignaciones.id, { onDelete: "cascade" }),
    categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
    peso: real("peso").notNull(), // porcentaje, ej. 40
  },
  (t) => [primaryKey({ columns: [t.asignacionId, t.categoria] })],
);

export const temas = sqliteTable("temas", {
  id: id(),
  asignacionId: integer("asignacion_id")
    .notNull()
    .references(() => asignaciones.id, { onDelete: "cascade" }),
  cuatrimestre: integer("cuatrimestre").notNull(), // 1 | 2
  titulo: text("titulo").notNull(),
  orden: integer("orden").notNull().default(0),
  creadoEn: creado(),
});

export const clases = sqliteTable(
  "clases",
  {
    id: id(),
    asignacionId: integer("asignacion_id")
      .notNull()
      .references(() => asignaciones.id, { onDelete: "cascade" }),
    fecha: text("fecha").notNull(), // YYYY-MM-DD
    cuatrimestre: integer("cuatrimestre").notNull(),
    temaId: integer("tema_id").references(() => temas.id, {
      onDelete: "set null",
    }),
    // false = clase prevista que no se dio (paro, acto, lluvia...)
    dictada: integer("dictada", { mode: "boolean" }).notNull().default(true),
    creadoEn: creado(),
  },
  (t) => [uniqueIndex("clase_asig_fecha").on(t.asignacionId, t.fecha)],
);


export const asistencias = sqliteTable(
  "asistencias",
  {
    claseId: integer("clase_id")
      .notNull()
      .references(() => clases.id, { onDelete: "cascade" }),
    inscripcionId: integer("inscripcion_id")
      .notNull()
      .references(() => inscripciones.id, { onDelete: "cascade" }),
    estado: text("estado", { enum: ESTADOS_ASISTENCIA }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.claseId, t.inscripcionId] })],
);

export const notas = sqliteTable("notas", {
  id: id(),
  asignacionId: integer("asignacion_id")
    .notNull()
    .references(() => asignaciones.id, { onDelete: "cascade" }),
  inscripcionId: integer("inscripcion_id")
    .notNull()
    .references(() => inscripciones.id, { onDelete: "cascade" }),
  cuatrimestre: integer("cuatrimestre").notNull(),
  categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
  temaId: integer("tema_id").references(() => temas.id, {
    onDelete: "set null",
  }),
  valor: real("valor").notNull(), // escala 1 a 10
  fecha: text("fecha").notNull(),
  origen: text("origen", { enum: ["manual", "quiz"] })
    .notNull()
    .default("manual"),
  quizRef: text("quiz_ref"), // id del intento en quizzes-profe-nacho, evita duplicados
  comentario: text("comentario"),
  creadoEn: creado(),
});


// Lo que va a las columnas de la planilla oficial. Lo que confirma el docente.
export const cierres = sqliteTable(
  "cierres",
  {
    asignacionId: integer("asignacion_id")
      .notNull()
      .references(() => asignaciones.id, { onDelete: "cascade" }),
    inscripcionId: integer("inscripcion_id")
      .notNull()
      .references(() => inscripciones.id, { onDelete: "cascade" }),
    valoracion1: text("valoracion_1", { enum: VALORACIONES }),
    calificacion1: integer("calificacion_1"),
    valoracion2: text("valoracion_2", { enum: VALORACIONES }),
    calificacion2: integer("calificacion_2"),
    intensificacion1: integer("intensificacion_1"),
    diciembre: integer("diciembre"),
    febrero: integer("febrero"),
    calificacionFinal: integer("calificacion_final"),
    observacionRite: text("observacion_rite"), // EPS: observaciones sobre el/la estudiante
    actualizadoEn: creado(),
  },
  (t) => [primaryKey({ columns: [t.asignacionId, t.inscripcionId] })],
);

/* ---------------- Calendario ---------------- */


// Arranca sin repetición; la repetición la elige el docente

export const eventos = sqliteTable("eventos", {
  id: id(),
  titulo: text("titulo").notNull(),
  tipo: text("tipo", { enum: TIPOS_EVENTO }).notNull().default("otro"),
  fechaInicio: text("fecha_inicio").notNull(), // YYYY-MM-DD
  fechaFin: text("fecha_fin"), // para eventos de varios días (intensificación, feria)
  horaInicio: text("hora_inicio"), // HH:MM, opcional
  horaFin: text("hora_fin"),
  nota: text("nota"),
  // A qué está asociado (todo opcional): una materia de un curso, una escuela, o nada
  asignacionId: integer("asignacion_id").references(() => asignaciones.id, { onDelete: "cascade" }),
  escuelaId: integer("escuela_id").references(() => escuelas.id, { onDelete: "cascade" }),
  repeticion: text("repeticion", { enum: REPETICIONES }).notNull().default("ninguna"),
  repetirHasta: text("repetir_hasta"), // última fecha posible de la serie
  avisarDiasAntes: integer("avisar_dias_antes"), // null = sin aviso
  creadoEn: creado(),
});

// Para borrar o mover una sola fecha de una serie ("esta semana no hay reunión")
export const eventosExcepciones = sqliteTable(
  "eventos_excepciones",
  {
    eventoId: integer("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    fecha: text("fecha").notNull(), // fecha original de la ocurrencia
    nuevaFecha: text("nueva_fecha"), // null = cancelada
  },
  (t) => [primaryKey({ columns: [t.eventoId, t.fecha] })],
);

// La nota del examen puede quedar colgada del evento
export const notasEvento = sqliteTable(
  "notas_evento",
  {
    notaId: integer("nota_id")
      .notNull()
      .references(() => notas.id, { onDelete: "cascade" }),
    eventoId: integer("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.notaId, t.eventoId] })],
);

/* ---------------- EPS: Plan de trabajo formativo ---------------- */

// La fila de tu área en el plan de cada estudiante: 5 casilleros de evaluación por nivel
export const planFormativo = sqliteTable(
  "plan_formativo",
  {
    asignacionId: integer("asignacion_id")
      .notNull()
      .references(() => asignaciones.id, { onDelete: "cascade" }),
    inscripcionId: integer("inscripcion_id")
      .notNull()
      .references(() => inscripciones.id, { onDelete: "cascade" }),
    nivel: integer("nivel").notNull(), // 1 a 4
    evaluaciones: text("evaluaciones", { mode: "json" }).$type<string[]>().notNull(),
    actualizadoEn: creado(),
  },
  (t) => [primaryKey({ columns: [t.asignacionId, t.inscripcionId, t.nivel] })],
);

/* ---------------- Planificación anual ---------------- */

// Lo que es texto corrido del modelo. En las listas, cada renglón es una viñeta.
export type PlanificacionAnual = {
  cargaHoraria?: string;
  fundamentacion?: string;
  objetivosEnsenanza?: string;
  objetivosAprendizaje?: string;
  estrategias?: string;
  recursos?: string;
  sistemaEvaluativo?: string;
  criterios?: string;
  bibliografiaDocente?: string;
  bibliografiaEstudiante?: string;
  proyectos?: string;
  observaciones?: string;
  fechaEntrega?: string;
};

export const planificaciones = sqliteTable("planificaciones", {
  asignacionId: integer("asignacion_id")
    .primaryKey()
    .references(() => asignaciones.id, { onDelete: "cascade" }),
  contenido: text("contenido", { mode: "json" }).$type<PlanificacionAnual>().notNull(),
  actualizadoEn: creado(),
});

// Unidades de la planificación, cada una en su cuatrimestre
export const unidades = sqliteTable("unidades", {
  id: id(),
  asignacionId: integer("asignacion_id")
    .notNull()
    .references(() => asignaciones.id, { onDelete: "cascade" }),
  cuatrimestre: integer("cuatrimestre").notNull(), // 1 | 2
  orden: integer("orden").notNull().default(0),
  titulo: text("titulo").notNull(), // "Unidad 1: Materia y energía"
  eje: text("eje"), // "Eje temático: …"
  contenidos: text("contenidos").notNull().default(""),
  creadoEn: creado(),
});

/* ---------------- Proyectos (salidas educativas, laboratorio, otros) ---------------- */

// Textos del proyecto; según el tipo, algunas partes cambian de nombre en la pantalla y en el archivo
export type ContenidoProyecto = {
  responsables?: string;
  fundamentacion?: string;
  objetivos?: string;
  contenidos?: string;
  antes?: string;
  durante?: string;
  despues?: string;
  recursos?: string;
  logistica?: string; // itinerario y traslado (salida) o normas de seguridad (laboratorio)
  evaluacion?: string;
  observaciones?: string;
};

export const proyectos = sqliteTable("proyectos", {
  id: id(),
  asignacionId: integer("asignacion_id")
    .notNull()
    .references(() => asignaciones.id, { onDelete: "cascade" }),
  tipo: text("tipo", { enum: TIPOS_PROYECTO }).notNull().default("salida"),
  titulo: text("titulo").notNull(),
  fecha: text("fecha"), // YYYY-MM-DD
  horaInicio: text("hora_inicio"),
  horaFin: text("hora_fin"),
  lugar: text("lugar"),
  contenido: text("contenido", { mode: "json" }).$type<ContenidoProyecto>().notNull(),
  conNomina: integer("con_nomina", { mode: "boolean" }).notNull().default(true),
  eventoId: integer("evento_id").references(() => eventos.id, { onDelete: "set null" }),
  creadoEn: creado(),
});
