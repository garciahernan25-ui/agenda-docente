import Link from "next/link";
import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { TURNOS } from "@/db/schema";
import { exigirDocente } from "@/lib/auth";
import { arbolCursos } from "@/lib/consultas";
import { hoyAR } from "@/lib/fechas";
import { salir } from "@/app/login/actions";
import { cambiarFormato, crearCurso, crearDivision, crearEscuela, crearModalidad } from "./actions";

export const metadata = { title: "Cursos · Agenda docente" };

export default function Config() {
  return (
    <>
      <Encabezado
        titulo="Escuelas y cursos"
        accion={
          <form action={salir}>
            <button className="text-sm text-texto-2">Salir</button>
          </form>
        }
      />
      <Suspense fallback={<Cargando />}>
        <Arbol />
      </Suspense>
    </>
  );
}

async function Arbol() {
  await exigirDocente();
  const arbol = await arbolCursos();
  const anio = Number(hoyAR().slice(0, 4));

  return (
    <div className="space-y-6">
      {arbol.length === 0 && (
        <p className="text-sm text-texto-2">Empezá creando una modalidad (Secundaria, Técnica, Agraria, Superior…).</p>
      )}

      {arbol.map((m) => (
        <section key={m.id}>
          <div className="flex items-center justify-between">
            <h2 className="titulo-seccion">{m.nombre}</h2>
            <form action={cambiarFormato} className="mt-4 flex items-center gap-1 text-xs text-texto-2">
              <input type="hidden" name="id" value={m.id} />
              Planillas:
              <select name="formato" defaultValue={m.formato} className="rounded-lg border border-borde bg-hoja px-2 py-1">
                <option value="secundaria">Secundaria común</option>
                <option value="eps">EPS (RITE + plan formativo)</option>
              </select>
              <button className="font-semibold text-tinta">OK</button>
            </form>
          </div>
          <div className="space-y-3">
            {m.escuelas.map((e) => (
              <div key={e.id} className="tarjeta p-4">
                <p className="font-semibold">{e.nombre}</p>
                {e.distrito && <p className="text-xs text-texto-2">{e.distrito}</p>}

                <ul className="mt-3 space-y-3">
                  {e.cursos.map((c) => (
                    <li key={c.id}>
                      <p className="text-sm font-medium">
                        {m.formato === "eps" ? `Nivel ${c.anio}` : `${c.anio} año`} · {c.cicloLectivo}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {c.divisiones.map((d) => (
                          <Link
                            key={d.id}
                            href={`/config/division/${d.id}`}
                            className="rounded-lg border border-borde px-3 py-1.5 text-sm"
                          >
                            {c.anio} {d.seccion} <span className="text-texto-2">· {d.turno}</span>
                            {d.materias.length > 0 && (
                              <span className="text-texto-2"> · {d.materias.map((a) => a.materia).join(", ")}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                      <Desplegable texto="+ División">
                        <form action={crearDivision} className="grid grid-cols-2 gap-2">
                          <input type="hidden" name="cursoId" value={c.id} />
                          <input name="seccion" required placeholder="Sección (A, B, C…)" className="campo" />
                          <select name="turno" className="campo" defaultValue="Mañana">
                            {TURNOS.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                          <input name="preceptor" placeholder="Preceptor/a" className="campo col-span-2" />
                          <button className="boton-primario col-span-2">Crear división</button>
                        </form>
                      </Desplegable>
                    </li>
                  ))}
                </ul>

                <Desplegable texto="+ Curso">
                  <form action={crearCurso} className="grid grid-cols-2 gap-2">
                    <input type="hidden" name="escuelaId" value={e.id} />
                    <input name="anio" required placeholder={m.formato === "eps" ? "Nivel (III-IV, 1…)" : "Año (1°, 2°…)"} className="campo" />
                    <input name="cicloLectivo" type="number" defaultValue={anio} className="campo" />
                    <button className="boton-primario col-span-2">Crear curso</button>
                  </form>
                </Desplegable>
              </div>
            ))}
            <Desplegable texto="+ Escuela">
              <form action={crearEscuela} className="space-y-2">
                <input type="hidden" name="modalidadId" value={m.id} />
                <input name="nombre" required placeholder="Nombre (EES N° 52)" className="campo" />
                <input name="distrito" placeholder="Distrito" className="campo" />
                <button className="boton-primario w-full">Crear escuela</button>
              </form>
            </Desplegable>
          </div>
        </section>
      ))}

      <section className="tarjeta p-4">
        <form action={crearModalidad} className="flex flex-wrap gap-2 sm:flex-nowrap">
          <input name="nombre" required placeholder="Nueva modalidad (Secundaria, EPS…)" className="campo" />
          <select name="formato" defaultValue="secundaria" className="campo w-auto shrink-0" aria-label="Planillas que usa">
            <option value="secundaria">Secundaria</option>
            <option value="eps">EPS</option>
          </select>
          <button className="boton-primario shrink-0">Crear</button>
        </form>
      </section>
    </div>
  );
}

function Desplegable({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer list-none text-sm font-semibold text-tinta">{texto}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
