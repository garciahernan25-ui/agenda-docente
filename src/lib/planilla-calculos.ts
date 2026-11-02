// Cuentas de la planilla de notas sin base de datos: las usa el servidor (PDF) y la pantalla editable.
import type { Valoracion } from "@/db/constantes";
import { totalesPeriodo } from "./calculos";

export type CierreFila = {
  valoracion1: Valoracion | null;
  calificacion1: number | null;
  valoracion2: Valoracion | null;
  calificacion2: number | null;
  intensificacion1: number | null;
  diciembre: number | null;
  febrero: number | null;
  calificacionFinal: number | null;
};

export type FilaPlanillaEditable = {
  inscripcionId: number;
  orden: number;
  apellidoNombre: string;
  baja: boolean;
  cursaRecursa: "C" | "R";
  observacion: string | null;
  parciales1: number[];
  parciales2: number[];
  inasistencias1: number | null;
  inasistencias2: number | null;
  concurrio1: boolean | null;
  concurrio2: boolean | null;
  calculada1: number | null;
  calculada2: number | null;
  sugerida1: Valoracion | null;
  sugerida2: Valoracion | null;
  cierre: CierreFila;
};

// Lo que va impreso: lo confirmado, y donde no confirmaste calificación, la calculada
export function calificacionImpresa(f: FilaPlanillaEditable, cierre: CierreFila, c: 1 | 2) {
  return c === 1 ? (cierre.calificacion1 ?? f.calculada1) : (cierre.calificacion2 ?? f.calculada2);
}

// Cuadro "Total de estudiantes / aprobados / desaprobados / sin evaluar" (sin contar bajas)
export function totalesDeFilas(filas: FilaPlanillaEditable[], cierres?: Record<number, CierreFila>) {
  const activos = filas.filter((f) => !f.baja);
  const periodo = (c: 1 | 2) => {
    const t = activos.map((f) => {
      const cal = calificacionImpresa(f, cierres?.[f.inscripcionId] ?? f.cierre, c);
      const concurrio = (c === 1 ? f.concurrio1 : f.concurrio2) ?? cal !== null;
      return { calificacion: cal, concurrio };
    });
    return t.some((x) => x.calificacion !== null) ? totalesPeriodo(t) : undefined;
  };
  return { c1: periodo(1), c2: periodo(2) };
}
