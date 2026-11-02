CREATE TABLE `plan_formativo` (
	`asignacion_id` integer NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`nivel` integer NOT NULL,
	`evaluaciones` text NOT NULL,
	`creado_en` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`asignacion_id`, `inscripcion_id`, `nivel`),
	FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `asignaciones` ADD `datos_eps` text;--> statement-breakpoint
ALTER TABLE `asignaciones` ADD `informe_contextual` text;--> statement-breakpoint
ALTER TABLE `cierres` ADD `observacion_rite` text;--> statement-breakpoint
ALTER TABLE `inscripciones` ADD `nivel` integer;--> statement-breakpoint
ALTER TABLE `inscripciones` ADD `inicio_eps` text;--> statement-breakpoint
ALTER TABLE `modalidades` ADD `formato` text DEFAULT 'secundaria' NOT NULL;