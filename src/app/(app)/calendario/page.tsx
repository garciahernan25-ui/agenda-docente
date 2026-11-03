import Link from "next/link";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { escuelas } from "@/db/schema";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { eventosEnRango, listarMaterias } from "@/lib/consultas";
import { sumarDias } from "@/lib/calendario";
import { fechaCortaMayus, hoyAR, MESES_LARGOS } from "@/lib/fechas";
import { COLOR_TIPO_EVENTO, NOMBRE_TIPO_EVENTO, PUNTO_TIPO_EVENTO } from "@/lib/textos";
import { AccionesEvento, FormEvento } from "./cliente";
import { nombreGrupo } from "@/lib/grupo";

export const metadata = { title: "Calendario · Agenda docente" };

export default function Calendario(props: PageProps<"/calendario">) {
  return (
    <>
      <Encabezado titulo="Calendario" />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirDocente();
  const sp = await searchParams;
  const hoy = hoyAR();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoy.slice(0, 7);
  const dia = typeof sp.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : null;

  const [y, m] = mes.split("-").map(Number);
  const primero = `${mes}-01`;
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const ultimo = `${mes}-${String(diasMes).padStart(2, "0")}`;
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // semana empieza el lunes
  const anterior = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const siguiente = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  const [ocs, materias, escs] = await Promise.all([
    eventosEnRango(primero, ultimo),
    listarMaterias(),
    db.select().from(escuelas).orderBy(asc(escuelas.nombre)),
  ]);

  const enDia = (f: string) => ocs.filter((o) => o.fecha <= f && f <= o.fechaFin);
  const celdas: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  const listado = dia ? enDia(dia) : ocs;

  return (
    <div className="space-y-4">
      <div className="tarjeta p-3">
        <div className="mb-2 flex items-center justify-between">
          <Link href={`?mes=${anterior}`} className="rounded-lg px-3 py-1 text-lg text-tinta" aria-label="Mes anterior">‹</Link>
          <p className="font-semibold">{MESES_LARGOS[m - 1].charAt(0).toUpperCase() + MESES_LARGOS[m - 1].slice(1)} {y}</p>
          <Link href={`?mes=${siguiente}`} className="rounded-lg px-3 py-1 text-lg text-tinta" aria-label="Mes siguiente">›</Link>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-texto-2">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="py-1">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {celdas.map((f, i) => {
            if (!f) return <span key={i} />;
            const evs = enDia(f);
            const sel = f === dia;
            return (
              <Link
                key={f}
                href={sel ? `?mes=${mes}` : `?mes=${mes}&dia=${f}`}
                className={`flex aspect-square flex-col items-center justify-start rounded-lg pt-1 text-sm ${
                  sel ? "bg-tinta text-hoja" : f === hoy ? "bg-tinta-suave font-bold text-tinta" : ""
                }`}
              >
                {Number(f.slice(8))}
                <span className="mt-0.5 flex gap-0.5">
                  {evs.slice(0, 3).map((o) => (
                    <span key={`${o.eventoId}${o.fecha}`} className={`size-1.5 rounded-full ${sel ? "bg-hoja" : PUNTO_TIPO_EVENTO[o.tipo]}`} />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <section>
        <h2 className="titulo-seccion">{dia ? fechaCortaMayus(dia) : "Este mes"}</h2>
        {listado.length === 0 ? (
          <p className="tarjeta p-4 text-sm text-texto-2">Nada agendado.</p>
        ) : (
          <ul className="tarjeta divide-y divide-borde">
            {listado.map((o) => {
              const materia = materias.find((x) => x.id === o.evento.asignacionId);
              const escuela = escs.find((x) => x.id === o.evento.escuelaId);
              return (
                <li key={`${o.eventoId}-${o.fecha}`} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="w-14 shrink-0 text-xs font-semibold text-texto-2">
                      {fechaCortaMayus(o.fecha).split(" ").slice(0, 2).join(" ")}
                      {o.fechaFin !== o.fecha && <> al {Number(o.fechaFin.slice(8))}</>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{o.titulo}</p>
                      <p className="text-xs text-texto-2">
                        {[
                          o.horaInicio && `${o.horaInicio}${o.horaFin ? `–${o.horaFin}` : ""}`,
                          materia && `${nombreGrupo(materia.formato, materia.anio, materia.seccion)} ${materia.materia}`,
                          escuela?.nombre,
                          o.evento.repeticion !== "ninguna" && `se repite (${o.evento.repeticion})`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {o.evento.nota && <p className="mt-1 text-xs">{o.evento.nota}</p>}
                    </div>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${COLOR_TIPO_EVENTO[o.tipo]}`}>
                      {NOMBRE_TIPO_EVENTO[o.tipo]}
                    </span>
                  </div>
                  <AccionesEvento eventoId={o.eventoId} fechaOriginal={o.fechaOriginal} repite={o.evento.repeticion !== "ninguna"} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FormEvento
        fechaInicial={dia ?? (mes === hoy.slice(0, 7) ? hoy : primero)}
        hastaSugerido={sumarDias(dia ?? hoy, 60)}
        materias={materias.map((x) => ({ id: x.id, nombre: `${nombreGrupo(x.formato, x.anio, x.seccion)} · ${x.materia} (${x.escuela})` }))}
        escuelas={escs.map((e) => ({ id: e.id, nombre: e.nombre }))}
      />
    </div>
  );
}
