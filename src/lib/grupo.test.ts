import { describe, expect, it } from "vitest";
import { nombreGrupo, rangoNiveles } from "./grupo";

describe("grupos", () => {
  it("secundaria muestra año y división; EPS solo la comisión", () => {
    expect(nombreGrupo("secundaria", "2°", "C")).toBe("2° C");
    expect(nombreGrupo("eps", "EPS", "Comisión 1")).toBe("Comisión 1");
  });
  it("arma el rango de niveles del RITE", () => {
    expect(rangoNiveles([4, 4, 4])).toBe("IV");
    expect(rangoNiveles([1, 4, 2, null])).toBe("I-IV");
    expect(rangoNiveles([3, 4])).toBe("III-IV");
    expect(rangoNiveles([null, undefined])).toBeNull();
  });
});
