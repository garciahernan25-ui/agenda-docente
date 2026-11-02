import { describe, expect, it } from "vitest";
import { crearTokenSesion, tokenValido, DURACION_SESION_S } from "./sesion";

describe("sesión", () => {
  it("un token recién creado es válido", async () => {
    expect(await tokenValido(await crearTokenSesion())).toBe(true);
  });
  it("vence", async () => {
    const t = await crearTokenSesion(0);
    expect(await tokenValido(t, (DURACION_SESION_S + 1) * 1000)).toBe(false);
  });
  it("rechaza tokens alterados o vacíos", async () => {
    const t = await crearTokenSesion();
    const [v, f] = t.split(".");
    expect(await tokenValido(`${Number(v) + 999}.${f}`)).toBe(false);
    expect(await tokenValido(`${v}.${f.slice(0, -2)}xx`)).toBe(false);
    expect(await tokenValido(undefined)).toBe(false);
    expect(await tokenValido("basura")).toBe(false);
  });
});
