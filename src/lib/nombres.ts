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

// Distancia de edición chica (para letra a mano: "ESPINOSA" ≈ "ESPINOZA")
function casiIgual(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let difs = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++difs > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return difs + (a.length - i) + (b.length - j) <= 1;
}

// Como parecido(), pero tolera una letra mal leída por palabra (para fotos de listas escritas a mano)
export function parecidoFlexible(leido: string, apellido: string, nombre: string) {
  const q = normal(leido).split(" ").filter(Boolean);
  const ap = normal(apellido).split(" ").filter(Boolean);
  const no = normal(nombre).split(" ").filter(Boolean);
  if (!q.length || !ap.length) return 0;
  const esta = (t: string) => q.some((x) => casiIgual(x, t));
  const apOk = ap.filter(esta).length / ap.length;
  if (apOk === 0) return 0;
  const noOk = no.length ? no.filter(esta).length / no.length : 0;
  return apOk * 0.6 + noOk * 0.4;
}
