import { readFile } from "node:fs/promises";
import path from "node:path";

let cache: Uint8Array | null = null;

export async function plantillaCalificaciones(): Promise<Uint8Array> {
  cache ??= new Uint8Array(
    await readFile(path.join(process.cwd(), "src/pdf/plantillas/planilla-calificaciones.pdf")),
  );
  return cache;
}
