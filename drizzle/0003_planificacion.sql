CREATE TABLE `planificaciones` (
	`asignacion_id` integer PRIMARY KEY NOT NULL,
	`contenido` text NOT NULL,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `unidades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asignacion_id` integer NOT NULL,
	`cuatrimestre` integer NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`titulo` text NOT NULL,
	`eje` text,
	`contenidos` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade
);
