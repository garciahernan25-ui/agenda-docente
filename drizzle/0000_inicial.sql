CREATE TABLE `alumnos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`apellido` text NOT NULL,
	`nombre` text NOT NULL,
	`dni` text,
	`quiz_alumno_id` text,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `asignaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`division_id` integer NOT NULL,
	`materia` text NOT NULL,
	`profesor` text NOT NULL,
	`total_clases_1` integer,
	`total_clases_2` integer,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`division_id`) REFERENCES `divisiones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `asistencias` (
	`clase_id` integer NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`estado` text NOT NULL,
	PRIMARY KEY(`clase_id`, `inscripcion_id`),
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cierres` (
	`asignacion_id` integer NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`valoracion_1` text,
	`calificacion_1` integer,
	`valoracion_2` text,
	`calificacion_2` integer,
	`intensificacion_1` integer,
	`diciembre` integer,
	`febrero` integer,
	`calificacion_final` integer,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`asignacion_id`, `inscripcion_id`),
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asignacion_id` integer NOT NULL,
	`fecha` text NOT NULL,
	`cuatrimestre` integer NOT NULL,
	`tema_id` integer,
	`dictada` integer DEFAULT true NOT NULL,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tema_id`) REFERENCES `temas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clase_asig_fecha` ON `clases` (`asignacion_id`,`fecha`);--> statement-breakpoint
CREATE TABLE `cursos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`escuela_id` integer NOT NULL,
	`anio` text NOT NULL,
	`ciclo_lectivo` integer NOT NULL,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`escuela_id`) REFERENCES `escuelas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `divisiones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`curso_id` integer NOT NULL,
	`seccion` text NOT NULL,
	`turno` text NOT NULL,
	`preceptor` text,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`curso_id`) REFERENCES `cursos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `escuelas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`modalidad_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`distrito` text,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`modalidad_id`) REFERENCES `modalidades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `inscripciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`division_id` integer NOT NULL,
	`alumno_id` integer NOT NULL,
	`orden` integer NOT NULL,
	`cursa_recursa` text DEFAULT 'C' NOT NULL,
	`estado` text DEFAULT 'activo' NOT NULL,
	`observacion` text,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`division_id`) REFERENCES `divisiones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `insc_div_alumno` ON `inscripciones` (`division_id`,`alumno_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `insc_div_orden` ON `inscripciones` (`division_id`,`orden`);--> statement-breakpoint
CREATE TABLE `modalidades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `modalidades_nombre_unique` ON `modalidades` (`nombre`);--> statement-breakpoint
CREATE TABLE `notas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asignacion_id` integer NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`cuatrimestre` integer NOT NULL,
	`categoria` text NOT NULL,
	`tema_id` integer,
	`valor` real NOT NULL,
	`fecha` text NOT NULL,
	`origen` text DEFAULT 'manual' NOT NULL,
	`quiz_ref` text,
	`comentario` text,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tema_id`) REFERENCES `temas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `pesos` (
	`asignacion_id` integer NOT NULL,
	`categoria` text NOT NULL,
	`peso` real NOT NULL,
	PRIMARY KEY(`asignacion_id`, `categoria`),
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `temas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asignacion_id` integer NOT NULL,
	`cuatrimestre` integer NOT NULL,
	`titulo` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade
);
