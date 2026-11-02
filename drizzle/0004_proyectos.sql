CREATE TABLE `proyectos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asignacion_id` integer NOT NULL,
	`tipo` text DEFAULT 'salida' NOT NULL,
	`titulo` text NOT NULL,
	`fecha` text,
	`hora_inicio` text,
	`hora_fin` text,
	`lugar` text,
	`contenido` text NOT NULL,
	`con_nomina` integer DEFAULT true NOT NULL,
	`evento_id` integer,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE no action ON DELETE set null
);
