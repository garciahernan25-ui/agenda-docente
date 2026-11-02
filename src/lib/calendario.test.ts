import { describe, expect, it } from "vitest";
import { esDiaSinClases, ocurrencias, type EventoBase } from "./calendario";

const ev = (e: Partial<EventoBase>): EventoBase => ({
  id: 1,
  titulo: "x",
  tipo: "otro",
  fechaInicio: "2026-11-03",
  repeticion: "ninguna",
  ...e,
});

describe("calendario", () => {
  it("evento suelto aparece una sola vez", () => {
    const o = ocurrencias([ev({ tipo: "examen" })], "2026-11-01", "2026-12-31");
    expect(o.map((x) => x.fecha)).toEqual(["2026-11-03"]);
  });

  it("evento fuera del rango no aparece", () => {
    expect(ocurrencias([ev({})], "2026-12-01", "2026-12-31")).toEqual([]);
  });

  it("semanal hasta una fecha", () => {
    const o = ocurrencias(
      [ev({ repeticion: "semanal", repetirHasta: "2026-11-24" })],
      "2026-11-01",
      "2026-12-31",
    );
    expect(o.map((x) => x.fecha)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  });

  it("semanal sin fin se corta en el rango pedido", () => {
    const o = ocurrencias([ev({ repeticion: "semanal" })], "2026-11-09", "2026-11-20");
    expect(o.map((x) => x.fecha)).toEqual(["2026-11-10", "2026-11-17"]);
  });

  it("quincenal", () => {
    const o = ocurrencias([ev({ repeticion: "quincenal" })], "2026-11-01", "2026-11-30");
    expect(o.map((x) => x.fecha)).toEqual(["2026-11-03", "2026-11-17"]);
  });

  it("mensual saltea meses sin ese día", () => {
    const o = ocurrencias(
      [ev({ fechaInicio: "2026-08-31", repeticion: "mensual" })],
      "2026-08-01",
      "2026-12-31",
    );
    expect(o.map((x) => x.fecha)).toEqual(["2026-08-31", "2026-10-31", "2026-12-31"]);
  });

  it("cancelar y mover una fecha de la serie", () => {
    const o = ocurrencias(
      [ev({ repeticion: "semanal", repetirHasta: "2026-11-24" })],
      "2026-11-01",
      "2026-11-30",
      [
        { eventoId: 1, fecha: "2026-11-10" },
        { eventoId: 1, fecha: "2026-11-17", nuevaFecha: "2026-11-19" },
      ],
    );
    expect(o.map((x) => [x.fecha, x.movida])).toEqual([
      ["2026-11-03", false],
      ["2026-11-19", true],
      ["2026-11-24", false],
    ]);
  });

  it("evento de varios días que empezó antes del rango igual aparece", () => {
    const o = ocurrencias(
      [ev({ tipo: "intensificacion", fechaInicio: "2026-12-07", fechaFin: "2026-12-18" })],
      "2026-12-14",
      "2026-12-31",
    );
    expect(o).toHaveLength(1);
    expect(o[0].fechaFin).toBe("2026-12-18");
  });

  it("detecta días sin clases dentro de un rango", () => {
    const o = ocurrencias(
      [ev({ tipo: "sin_clases", fechaInicio: "2026-11-23", fechaFin: "2026-11-24" })],
      "2026-11-01",
      "2026-11-30",
    );
    expect(esDiaSinClases("2026-11-24", o)).toBe(true);
    expect(esDiaSinClases("2026-11-25", o)).toBe(false);
  });

  it("ordena por fecha y hora", () => {
    const o = ocurrencias(
      [
        ev({ id: 1, titulo: "b", horaInicio: "10:00" }),
        ev({ id: 2, titulo: "a", horaInicio: "08:00" }),
      ],
      "2026-11-01",
      "2026-11-30",
    );
    expect(o.map((x) => x.titulo)).toEqual(["a", "b"]);
  });
});
