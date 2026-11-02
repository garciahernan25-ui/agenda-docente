import Link from "next/link";
import { Suspense } from "react";
import { Cargando, Vacio } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { eventosEnRango, listarMaterias } from "@/lib/consultas";
import { sumarDias } from "@/lib/calendario";
import { fechaCortaMayus, hoyAR } from "@/lib/fechas";
import { COLOR_TIPO_EVENTO, NOMBRE_TIPO_EVENTO } from "@/lib/textos";

export default function Inicio() {
  return (
    <div className="pt-6">
      <h1 className="text-2xl font-bold">Agenda docente</h1>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  await exigirDocente();
  const hoy = hoyAR();
  const [materias, proximos] = await Promise.all([listarMaterias(), eventosEnRango(hoy, sumarDias(hoy, 14))]);

  const porEscuela = new Map<string, typeof materias>();
  for (const m of materias) porEscuela.set(m.escuela, [...(porEscuela.get(m.escuela) ?? []), m]);

  return (
    <>
      <p className="text-sm text-texto-2">{fechaCortaMayus(hoy)}</p>

      <h2 className="titulo-seccion">Próximas dos semanas</h2>
      {proximos.length === 0 ? (
        <Vacio>
          Nada agendado.{" "}
          <Link href="/calendario" className="font-semibold text-tinta">
            Ir al calendario
          </Link>
        </Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-borde">
          {proximos.slice(0, 6).map((o) => (
            <li key={`${o.eventoId}-${o.fecha}`} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`w-16 shrink-0 text-xs font-semibold ${o.fecha === hoy ? "text-tinta" : "text-texto-2"}`}>
                {o.fecha === hoy ? "Hoy" : fechaCortaMayus(o.fecha).split(" ").slice(0, 2).join(" ")}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {o.titulo}
                {o.horaInicio && <span className="text-texto-2"> · {o.horaInicio}</span>}
              </span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${COLOR_TIPO_EVENTO[o.tipo]}`}>
                {NOMBRE_TIPO_EVENTO[o.tipo]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {materias.length === 0 && (
        <>
          <h2 className="titulo-seccion">Mis cursos</h2>
          <Vacio>
            Todavía no hay cursos.{" "}
            <Link href="/config" className="font-semibold text-tinta">
              Cargá tu primera escuela
            </Link>
          </Vacio>
        </>
      )}

      {[...porEscuela].map(([escuela, ms]) => (
        <section key={escuela}>
          <h2 className="titulo-seccion">{escuela}</h2>
          <ul className="space-y-2">
            {ms.map((m) => (
              <li key={m.id} className="tarjeta flex items-center gap-3 p-3 pl-4">
                <Link href={`/materias/${m.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {m.anio} {m.seccion} <span className="font-normal">· {m.materia}</span>
                  </p>
                  <p className="text-xs text-texto-2">{m.turno}</p>
                </Link>
                <Link href={`/materias/${m.id}/asistencia`} className="boton-primario shrink-0 px-3 py-2">
                  Asistencia
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
