import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const { hashClave, verificarClave } = await import("./auth");

describe("contraseña", () => {
  it("acepta la correcta y rechaza las demás", async () => {
    const h = await hashClave("prueba1234");
    expect(h).not.toContain("$");
    expect(await verificarClave("prueba1234", h)).toBe(true);
    expect(await verificarClave("prueba12345", h)).toBe(false);
    expect(await verificarClave("prueba1234", undefined)).toBe(false);
    expect(await verificarClave("prueba1234", "basura")).toBe(false);
  });
});
