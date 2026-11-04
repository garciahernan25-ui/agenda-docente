// Tipos de evaluación de una materia (lo que se puede usar también en el navegador)
import { CATEGORIAS, CATEGORIAS_FIJAS } from "@/db/constantes";
import { PESOS_POR_DEFECTO } from "./calculos";
import { NOMBRE_CATEGORIA } from "./textos";

export type TipoEval = {
  clave: string; // "tp_escrito", "x_carpeta"…
  nombre: string;
  corto: string; // para las columnas angostas de la grilla
  peso: number;
  fijo: boolean; // quiz y examen no se pueden sacar
  oculta: boolean;
};

const CORTO_BASE: Record<string, string> = {
  participacion: "Particip.",
  desempeno: "Desemp.",
  tp_escrito: "TP escrito",
  actividad_virtual: "Act. virtual",
  oral: "Oral",
  quiz: "Quiz",
  examen: "Examen",
};

export const esFija = (clave: string) => (CATEGORIAS_FIJAS as readonly string[]).includes(clave);

export function corto(nombre: string) {
  return nombre.length > 12 ? `${nombre.slice(0, 11)}.` : nombre;
}

type Fila = { categoria: string; peso: number; nombre: string | null; orden: number; oculta: boolean };

// Arma la lista con lo guardado; si la materia no tiene nada guardado, los de base con sus pesos de siempre
export function armarTipos(filas: Fila[]): TipoEval[] {
  const lista: (TipoEval & { orden: number })[] = filas.map((f) => {
    const nombre = f.nombre?.trim() || NOMBRE_CATEGORIA[f.categoria] || f.categoria;
    return {
      clave: f.categoria,
      nombre,
      // si conserva el nombre de base, la abreviatura de siempre; si lo cambiaste, el nombre nuevo (recortado)
      corto: nombre === NOMBRE_CATEGORIA[f.categoria] ? (CORTO_BASE[f.categoria] ?? corto(nombre)) : corto(nombre),
      peso: f.peso,
      fijo: esFija(f.categoria),
      oculta: esFija(f.categoria) ? false : f.oculta,
      orden: f.orden,
    };
  });
  // Los de base que falten (materias viejas o filas que nunca se guardaron)
  CATEGORIAS.forEach((c, i) => {
    if (!lista.some((t) => t.clave === c)) {
      lista.push({ clave: c, nombre: NOMBRE_CATEGORIA[c], corto: CORTO_BASE[c], peso: PESOS_POR_DEFECTO[c] ?? 0, fijo: esFija(c), oculta: false, orden: 1000 + i });
    }
  });
  // Si nadie ordenó todavía (todos en 0), el orden de base
  const sinOrden = lista.every((t) => t.orden === 0);
  return lista
    .map((t) => ({ ...t, orden: sinOrden ? ((CATEGORIAS as readonly string[]).indexOf(t.clave) + 1 || 999) : t.orden }))
    .sort((a, b) => a.orden - b.orden)
    // el examen siempre al final: es la nota del cuatrimestre
    .sort((a, b) => Number(a.clave === "examen") - Number(b.clave === "examen"))
    .map(({ clave, nombre, corto, peso, fijo, oculta }) => ({ clave, nombre, corto, peso, fijo, oculta }));
}

export function pesosDeTipos(tipos: TipoEval[]) {
  return Object.fromEntries(tipos.map((t) => [t.clave, t.peso])) as Record<string, number>;
}

export function nombresDeTipos(tipos: TipoEval[]) {
  return Object.fromEntries(tipos.map((t) => [t.clave, t.nombre])) as Record<string, string>;
}
