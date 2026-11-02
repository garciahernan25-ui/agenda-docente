CREATE TABLE `eventos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titulo` text NOT NULL,
	`tipo` text DEFAULT 'otro' NOT NULL,
	`fecha_inicio` text NOT NULL,
	`fecha_fin` text,
	`hora_inicio` text,
	`hora_fin` text,
	`nota` text,
	`asignacion_id` integer,
	`escuela_id` integer,
	`repeticion` text DEFAULT 'ninguna' NOT NULL,
	`repetir_hasta` text,
	`avisar_dias_antes` integer,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`escuela_id`) REFERENCES `escuelas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `eventos_excepciones` (
	`evento_id` integer NOT NULL,
	`fecha` text NOT NULL,
	`nueva_fecha` text,
	PRIMARY KEY(`evento_id`, `fecha`),
	FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notas_evento` (
	`nota_id` integer NOT NULL,
	`evento_id` integer NOT NULL,
	PRIMARY KEY(`nota_id`, `evento_id`),
	FOREIGN KEY (`nota_id`) REFERENCES `notas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE no action ON DELETE cascade
);
