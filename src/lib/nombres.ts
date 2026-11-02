// Comparar nombres escritos de distintas formas ("Thiago Flores" y "FLORES, Thiago")
export const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Qué tan parecido es "Thiago Flores" a FLORES, Thiago (0 a 1). Necesita que coincida el apellido.
export function parecido(nombreQuiz: string, apellido: string, nombre: string) {
  const q = new Set(normal(nombreQuiz).split(" ").filter(Boolean));
  const ap = normal(apellido).split(" ").filter(Boolean);
  const no = normal(nombre).split(" ").filter(Boolean);
  if (!q.size || !ap.length) return 0;
  const apOk = ap.filter((t) => q.has(t)).length / ap.length;
  if (apOk === 0) return 0;
  const noOk = no.length ? no.filter((t) => q.has(t)).length / no.length : 0;
  return apOk * 0.6 + noOk * 0.4;
}
