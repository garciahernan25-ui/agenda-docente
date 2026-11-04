ALTER TABLE `pesos` ADD `nombre` text;--> statement-breakpoint
ALTER TABLE `pesos` ADD `orden` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pesos` ADD `oculta` integer DEFAULT false NOT NULL;