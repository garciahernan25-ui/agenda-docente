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

import { parecidoFlexible } from "./nombres";
describe("parecido flexible (fotos)", () => {
  it("tolera una letra mal leída", () => {
    expect(parecidoFlexible("Espinosa Bruno", "ESPINOZA", "Bruno")).toBe(1);
    // palabras cortas (menos de 5 letras) tienen que coincidir justo: "SOSA" no es "SORA"
    expect(parecidoFlexible("Sora Ana", "SOSA", "Ana")).toBe(0);
    expect(parecidoFlexible("Gomez Ana", "GOMEZ", "Ana")).toBe(1);
    expect(parecidoFlexible("Lopez Ana", "GOMEZ", "Ana")).toBe(0);
  });
});
