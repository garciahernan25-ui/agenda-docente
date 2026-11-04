import { describe, expect, it } from "vitest";
import { armarTipos } from "./tipos-comun";
import { calificacionPonderada } from "./calculos";

const fila = (categoria: string, peso: number, extra: Partial<{ nombre: string; orden: number; oculta: boolean }> = {}) => ({
  categoria,
  peso,
  nombre: extra.nombre ?? null,
  orden: extra.orden ?? 0,
  oculta: extra.oculta ?? false,
});

describe("tipos de evaluación", () => {
  it("sin nada guardado trae los 7 de base, con el examen al final", () => {
    const t = armarTipos([]);
    expect(t.map((x) => x.clave)).toEqual(["participacion", "desempeno", "tp_escrito", "actividad_virtual", "oral", "quiz", "examen"]);
    expect(t.find((x) => x.clave === "quiz")?.fijo).toBe(true);
  });
  it("respeta nombres, orden, agregados y sacados; quiz y examen nunca se ocultan", () => {
    const t = armarTipos([
      fila("x_carpeta", 20, { nombre: "Carpeta", orden: 1 }),
      fila("oral", 5, { nombre: "Oral", orden: 2 }),
      fila("examen", 40, { orden: 3 }),
      fila("quiz", 10, { orden: 4, oculta: true }),
      fila("actividad_virtual", 10, { orden: 900, oculta: true }),
    ]);
    expect(t[0]).toMatchObject({ clave: "x_carpeta", nombre: "Carpeta", peso: 20, fijo: false });
    expect(t.at(-1)?.clave).toBe("examen");
    expect(t.find((x) => x.clave === "quiz")?.oculta).toBe(false);
    expect(t.find((x) => x.clave === "actividad_virtual")?.oculta).toBe(true);
  });
  it("un tipo agregado cuenta en el promedio con su peso", () => {
    const c = calificacionPonderada(
      [
        { categoria: "x_carpeta", valor: 10 },
        { categoria: "examen", valor: 6 },
      ],
      { x_carpeta: 50, examen: 50 },
    );
    expect(c?.exacta).toBe(8);
  });
});
