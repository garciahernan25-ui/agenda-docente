import { describe, expect, it } from "vitest";
import {
  calificacionPonderada,
  notaEntera,
  parcialesParaPlanilla,
  porcentajePresentesClase,
  resumenAsistencia,
  sugerirValoracion,
  totalesPeriodo,
  valoracionDesdeNota,
} from "./calculos";

describe("asistencia", () => {
  it("tarde vale media falta y la justificada no suma", () => {
    const r = resumenAsistencia(["P", "A", "T", "T", "J", "P", "P", "P", "P", "P"]);
    expect(r.inasistencias).toBe(2);
    expect(r.justificadas).toBe(1);
    expect(r.porcentaje).toBe(80);
    expect(r.concurrio).toBe(true);
  });
  it("sin clases no hay porcentaje", () => {
    expect(resumenAsistencia([]).porcentaje).toBeNull();
  });
  it("si solo tiene ausentes y justificadas no concurrió", () => {
    expect(resumenAsistencia(["A", "J", "A"]).concurrio).toBe(false);
  });
  it("porcentaje de presentes por clase", () => {
    expect(porcentajePresentesClase(["P", "T", "A", "J"])).toBe(50);
  });
});

describe("calificación ponderada", () => {
  it("pondera por categoría", () => {
    const c = calificacionPonderada(
      [
        { categoria: "examen", valor: 6 },
        { categoria: "tp_escrito", valor: 8 },
        { categoria: "tp_escrito", valor: 10 },
      ],
      { examen: 50, tp_escrito: 50 },
    );
    expect(c).toEqual({ exacta: 7.5, entera: 8 });
  });
  it("reparte el peso de categorías sin notas", () => {
    const c = calificacionPonderada([{ categoria: "oral", valor: 5 }], {
      oral: 10,
      examen: 90,
    });
    expect(c?.entera).toBe(5);
  });
  it("sin notas devuelve null", () => {
    expect(calificacionPonderada([])).toBeNull();
  });
  it("redondea 6,5 a 7 y no sale de 1 a 10", () => {
    expect(notaEntera(6.5)).toBe(7);
    expect(notaEntera(0.2)).toBe(1);
    expect(notaEntera(10.4)).toBe(10);
  });
});

describe("valoración preliminar", () => {
  it("rangos TEA/TEP/TED", () => {
    expect(valoracionDesdeNota(7)).toBe("TEA");
    expect(valoracionDesdeNota(6.4)).toBe("TEP");
    expect(valoracionDesdeNota(6.5)).toBe("TEA");
    expect(valoracionDesdeNota(3)).toBe("TED");
  });
  it("sugiere según las notas", () => {
    expect(sugerirValoracion([{ categoria: "participacion", valor: 4 }])).toBe("TEP");
    expect(sugerirValoracion([])).toBeNull();
  });
});

describe("parciales de la planilla", () => {
  it("un casillero por tema y el examen al final", () => {
    const p = parcialesParaPlanilla(
      [
        { categoria: "tp_escrito", valor: 8, temaId: 1 },
        { categoria: "oral", valor: 6, temaId: 1 },
        { categoria: "quiz", valor: 9, temaId: 2 },
        { categoria: "examen", valor: 5 },
      ],
      [1, 2],
    );
    expect(p).toEqual([7, 9, 5]);
  });
  it("agrupa si hay más temas que casilleros", () => {
    const notas = [1, 2, 3, 4, 5, 6].map((t) => ({
      categoria: "tp_escrito" as const,
      valor: t + 3,
      temaId: t,
    }));
    const p = parcialesParaPlanilla(
      [...notas, { categoria: "examen", valor: 8 }],
      [1, 2, 3, 4, 5, 6],
    );
    expect(p).toHaveLength(5);
    expect(p.at(-1)).toBe(8);
  });
});

describe("cuadro de totales", () => {
  it("cuenta aprobados, desaprobados y sin evaluar", () => {
    expect(
      totalesPeriodo([
        { calificacion: 7, concurrio: true },
        { calificacion: 4, concurrio: true },
        { calificacion: null, concurrio: false },
        { calificacion: 9, concurrio: true },
      ]),
    ).toEqual({ total: 4, aprobados: 2, desaprobados: 1, sinEvaluar: 1 });
  });
});
