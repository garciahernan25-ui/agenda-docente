// Expande los eventos (con su repetición y excepciones) a las fechas concretas de un rango.
// Puro, sin base de datos: sirve igual en el servidor y offline en el celular.
import type { Repeticion, TipoEvento } from "@/db/schema";

export type EventoBase = {
  id: number;
  titulo: string;
  tipo: TipoEvento;
  fechaInicio: string;
  fechaFin?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  repeticion: Repeticion;
  repetirHasta?: string | null;
};

export type Excepcion = { eventoId: number; fecha: string; nuevaFecha?: string | null };

export type Ocurrencia = {
  eventoId: number;
  titulo: string;
  tipo: TipoEvento;
  fecha: string; // día de inicio de esta ocurrencia
  fechaFin: string; // igual a fecha si dura un día
  fechaOriginal: string; // para crear excepciones sobre esta ocurrencia
  horaInicio?: string | null;
  horaFin?: string | null;
  movida: boolean;
};

const MAX_OCURRENCIAS = 500; // corta series sin fin de repetición

export function ocurrencias(
  eventos: EventoBase[],
  desde: string,
  hasta: string,
  excepciones: Excepcion[] = [],
): Ocurrencia[] {
  const exc = new Map(excepciones.map((e) => [`${e.eventoId}:${e.fecha}`, e]));
  const out: Ocurrencia[] = [];

  for (const ev of eventos) {
    const duracion = ev.fechaFin ? diasEntre(ev.fechaInicio, ev.fechaFin) : 0;
    const finSerie = ev.repeticion === "ninguna" ? ev.fechaInicio : (ev.repetirHasta ?? hasta);

    for (let i = 0; i < MAX_OCURRENCIAS; i++) {
      const original = enesimaFecha(ev.fechaInicio, ev.repeticion, i);
      if (original === null) continue; // ej. 31 en un mes de 30 días
      if (original > finSerie || original > hasta) break;

      const e = exc.get(`${ev.id}:${original}`);
      if (e && !e.nuevaFecha) continue; // cancelada
      const fecha = e?.nuevaFecha ?? original;
      const fechaFin = sumarDias(fecha, duracion);
      // entra si se superpone con el rango pedido
      if (fechaFin < desde || fecha > hasta) {
        if (ev.repeticion === "ninguna") break;
        continue;
      }
      out.push({
        eventoId: ev.id,
        titulo: ev.titulo,
        tipo: ev.tipo,
        fecha,
        fechaFin,
        fechaOriginal: original,
        horaInicio: ev.horaInicio,
        horaFin: ev.horaFin,
        movida: !!e?.nuevaFecha,
      });
      if (ev.repeticion === "ninguna") break;
    }
  }
  return out.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio ?? "").localeCompare(b.horaInicio ?? ""),
  );
}

// ¿Ese día hay un evento "sin clases"? Lo usa la asistencia para marcar la clase como no dictada
export function esDiaSinClases(fecha: string, ocs: Ocurrencia[]): boolean {
  return ocs.some((o) => o.tipo === "sin_clases" && o.fecha <= fecha && fecha <= o.fechaFin);
}

function enesimaFecha(inicio: string, rep: Repeticion, n: number): string | null {
  if (n === 0) return inicio;
  switch (rep) {
    case "ninguna":
      return null;
    case "semanal":
      return sumarDias(inicio, 7 * n);
    case "quincenal":
      return sumarDias(inicio, 14 * n);
    case "mensual": {
      const [y, m, d] = inicio.split("-").map(Number);
      const fecha = new Date(Date.UTC(y, m - 1 + n, d));
      // si el mes no tiene ese día (31 de abril), esa ocurrencia no existe
      if (fecha.getUTCDate() !== d) return null;
      return iso(fecha);
    }
  }
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return iso(new Date(Date.UTC(y, m - 1, d + dias)));
}

function diasEntre(a: string, b: string) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
