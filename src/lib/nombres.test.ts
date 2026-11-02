import { describe, expect, it } from "vitest";
import { normal, parecido } from "./nombres";

describe("comparar nombres", () => {
  it("normaliza tildes, mayúsculas y signos", () => {
    expect(normal("  Energía   Mecánica! ")).toBe("energia mecanica");
    expect(normal("NÚÑEZ")).toBe("nunez");
  });
  it("reconoce al mismo estudiante en otro orden", () => {
    expect(parecido("Thiago Flores", "FLORES", "Thiago")).toBe(1);
    expect(parecido("thiago flores", "Flores", "Thiago Benjamín")).toBeCloseTo(0.8);
  });
  it("sin el apellido no hay parecido", () => {
    expect(parecido("Thiago Vega", "FLORES", "Thiago")).toBe(0);
  });
  it("mismo apellido y otro nombre queda por debajo de uno completo", () => {
    expect(parecido("Bianca Mora", "MORA", "Lucas")).toBeLessThan(parecido("Lucas Mora", "MORA", "Lucas"));
  });
});
