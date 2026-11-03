// Cómo se nombra un grupo de estudiantes: en secundaria "2° C"; en la EPS, la comisión ("Comisión 1")
import type { Formato } from "@/db/constantes";

export function nombreGrupo(formato: Formato | string, anio: string, seccion: string) {
  return formato === "eps" ? seccion : `${anio} ${seccion}`;
}

export function grupoDe(cab: { modalidad: { formato: string }; curso: { anio: string }; div: { seccion: string } }) {
  return nombreGrupo(cab.modalidad.formato, cab.curso.anio, cab.div.seccion);
}

// Palabras que cambian según la modalidad
export function textosGrupo(formato: Formato | string) {
  const eps = formato === "eps";
  return {
    grupo: eps ? "comisión" : "división",
    Grupo: eps ? "Comisión" : "División",
    responsable: eps ? "Coordinador/a" : "Preceptor/a",
  };
}

const ROMANOS = ["", "I", "II", "III", "IV"];

// "I-IV" con los niveles que hay en la comisión ("IV" si son todos del mismo); null si nadie tiene nivel
export function rangoNiveles(niveles: (number | null | undefined)[]) {
  const n = niveles.filter((x): x is number => !!x && x >= 1 && x <= 4);
  if (!n.length) return null;
  const min = Math.min(...n);
  const max = Math.max(...n);
  return min === max ? ROMANOS[min] : `${ROMANOS[min]}-${ROMANOS[max]}`;
}
