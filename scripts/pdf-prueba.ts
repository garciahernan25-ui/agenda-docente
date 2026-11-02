/*
 * Genera PDFs de prueba sin base de datos, con datos inventados, para revisar el diseño.
 * Uso: npm run pdf:prueba  → salida en ./salida
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generarPlanillaCalificaciones } from "@/pdf/planilla-calificaciones";
import { generarPlanillaAsistencia } from "@/pdf/planilla-asistencia";
import type { EstadoAsistencia } from "@/db/schema";
import { resumenAsistencia, totalesPeriodo } from "@/lib/calculos";

const nombres = [
  "ALVAREZ, Sofía", "BENÍTEZ, Mateo", "CABRERA, Luana", "DÍAZ, Benjamín", "ESCOBAR, Camila",
  "FERNÁNDEZ, Tomás", "GÓMEZ, Valentina", "HERRERA, Santiago", "IBÁÑEZ, Martina", "JUÁREZ, Lautaro",
  "LÓPEZ, Abril", "MEDINA, Joaquín", "NAVARRO, Catalina", "OLIVERA, Thiago", "PAZ, Delfina",
  "QUIROGA, Bautista", "RÍOS, Emilia", "SOSA, Felipe", "TORRES, Mía", "VERA, Agustín",
];
const fechas = Array.from({ length: 34 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 2, 2 + Math.floor(i / 2) * 7 + (i % 2) * 2));
  return d.toISOString().slice(0, 10);
});
let semilla = 7;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
const estado = (): EstadoAsistencia => {
  const r = azar();
  return r < 0.78 ? "P" : r < 0.9 ? "A" : r < 0.96 ? "T" : "J";
};

async function main() {
  await mkdir("salida", { recursive: true });
  const estados = nombres.map(() => fechas.map(estado));
  const filas = nombres.map((n, i) => {
    const r = resumenAsistencia(estados[i]);
    const p = [6, 7, 8, 5, 9].map((x) => Math.max(1, Math.min(10, x + Math.round(azar() * 4 - 2))));
    const cal = Math.round(p.reduce((a, b) => a + b, 0) / p.length);
    return {
      orden: i + 1,
      apellidoNombre: n,
      cursaRecursa: (i === 4 ? "R" : "C") as "C" | "R",
      parciales1: p,
      valoracion1: (cal >= 7 ? "TEA" : cal >= 4 ? "TEP" : "TED") as "TEA" | "TEP" | "TED",
      calificacion1: cal,
      inasistencias1: r.inasistencias,
      parciales2: [],
      _concurrio: r.concurrio,
    };
  });
  const plantilla = new Uint8Array(await readFile("src/pdf/plantillas/planilla-calificaciones.pdf"));
  const cal = await generarPlanillaCalificaciones(plantilla, {
    escuela: "EES N° 99 (prueba)",
    cicloLectivo: 2026,
    materia: "Fisicoquímica",
    profesor: "Hernán Andrés García",
    anio: "2°",
    seccion: "A",
    turno: "Mañana",
    preceptor: "Preceptora de prueba",
    filas,
    totales: { c1: totalesPeriodo(filas.map((f) => ({ calificacion: f.calificacion1, concurrio: f._concurrio }))) },
    clases: { totales1: 36, dadas1: fechas.length },
  });
  await writeFile("salida/planilla-calificaciones-prueba.pdf", cal);

  const asis = await generarPlanillaAsistencia({
    escuela: "EES N° 99 (prueba)",
    materia: "Fisicoquímica",
    profesor: "Hernán Andrés García",
    curso: "2° A – Mañana",
    periodo: "1° cuatrimestre 2026",
    fechas,
    alumnos: nombres.map((n, i) => ({ orden: i + 1, apellidoNombre: n, baja: i === 17, estados: estados[i] })),
  });
  await writeFile("salida/planilla-asistencia-prueba.pdf", asis);
  console.log("PDFs en ./salida");
}

main();
