import { describe, expect, it } from "vitest";
import { calificacionImpresa, totalesDeFilas, type FilaPlanillaEditable } from "./planilla-calculos";

const vacio = { valoracion1: null, calificacion1: null, valoracion2: null, calificacion2: null, intensificacion1: null, diciembre: null, febrero: null, calificacionFinal: null };
const fila = (id: number, extra: Partial<FilaPlanillaEditable> = {}): FilaPlanillaEditable => ({
  inscripcionId: id, orden: id, apellidoNombre: `A${id}`, baja: false, cursaRecursa: "C", observacion: null,
  parciales1: [], parciales2: [], inasistencias1: null, inasistencias2: null, concurrio1: true, concurrio2: true,
  calculada1: null, calculada2: null, sugerida1: null, sugerida2: null, cierre: vacio, ...extra,
});

describe("planilla de notas", () => {
  it("imprime lo confirmado y si no hay, lo calculado", () => {
    const f = fila(1, { calculada1: 6 });
    expect(calificacionImpresa(f, f.cierre, 1)).toBe(6);
    expect(calificacionImpresa(f, { ...vacio, calificacion1: 8 }, 1)).toBe(8);
  });
  it("totales sin bajas y con los cambios que todavía no guardaste", () => {
    const filas = [fila(1, { calculada1: 7 }), fila(2, { calculada1: 4 }), fila(3, { baja: true, calculada1: 2 }), fila(4, { concurrio1: false })];
    expect(totalesDeFilas(filas).c1).toEqual({ total: 3, aprobados: 1, desaprobados: 1, sinEvaluar: 1 });
    const editado = { 2: { ...vacio, calificacion1: 9 } };
    expect(totalesDeFilas(filas, editado).c1).toEqual({ total: 3, aprobados: 2, desaprobados: 0, sinEvaluar: 1 });
    expect(totalesDeFilas(filas).c2).toBeUndefined();
  });
});
