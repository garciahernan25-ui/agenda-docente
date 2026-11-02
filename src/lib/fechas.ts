// Fechas en hora de Argentina (el servidor de Vercel corre en UTC)
const ZONA = "America/Argentina/Buenos_Aires";

export function hoyAR(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d); // YYYY-MM-DD
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function partes(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

// "mar 3 nov"
export function fechaCorta(iso: string): string {
  const { m, d, dow } = partes(iso);
  return `${DIAS[dow]} ${d} ${MESES[m - 1]}`;
}

// "Mar 3 nov": para el comienzo de una línea
export function fechaCortaMayus(iso: string): string {
  const f = fechaCorta(iso);
  return f.charAt(0).toUpperCase() + f.slice(1);
}

// "3/11"
export function fechaMini(iso: string): string {
  const { m, d } = partes(iso);
  return `${d}/${m}`;
}

// Cuatrimestre según la fecha: marzo–julio 1°, agosto en adelante 2°
export function cuatrimestreDe(iso: string): 1 | 2 {
  return partes(iso).m <= 7 ? 1 : 2;
}
