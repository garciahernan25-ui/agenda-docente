import Link from "next/link";
import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { TURNOS } from "@/db/schema";
import { exigirDocente } from "@/lib/auth";
import { arbolCursos } from "@/lib/consultas";
import { hoyAR } from "@/lib/fechas";
import { salir } from "@/app/login/actions";
import { BotonBorrar } from "@/components/boton-borrar";
import { borrarElemento, crearComision, crearCurso, crearDivision, crearEscuela, crearModalidad, editarCurso, editarEscuela, editarModalidad } from "./actions";

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
          <div className="mt-6 mb-2 flex flex-wrap items-center justify-between gap-x-3">
            <h2 className="titulo-seccion my-0">
              {m.nombre}
              <span className="ml-2 font-normal normal-case tracking-normal">
                · {m.formato === "eps" ? "planillas EPS" : "planillas de secundaria"}
              </span>
            </h2>
            <Editar>
              <form action={editarModalidad} className="space-y-2">
                <input type="hidden" name="id" value={m.id} />
                <label className="block">
                  <span className="etiqueta">Nombre de la modalidad</span>
                  <input name="nombre" required defaultValue={m.nombre} className="campo" />
                </label>
                <label className="block">
                  <span className="etiqueta">Planillas que usa</span>
                  <select name="formato" defaultValue={m.formato} className="campo">
                    <option value="secundaria">Secundaria común</option>
                    <option value="eps">EPS (RITE + plan formativo)</option>
                  </select>
                </label>
                <button className="boton-primario w-full">Guardar</button>
              </form>
              <div className="mt-3 text-center">
                <BotonBorrar
                  accion={borrarElemento}
                  campos={{ nivel: "modalidad", id: m.id }}
                  texto="Borrar modalidad"
                  aviso={`Se borra "${m.nombre}" con todas sus escuelas, cursos, alumnos, notas y asistencias.`}
                />
              </div>
            </Editar>
          </div>
          <div className="space-y-3">
            {m.escuelas.map((e) => (
              <div key={e.id} className="tarjeta p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-3">
                  <div>
                    <p className="font-semibold">{e.nombre}</p>
                    {e.distrito && <p className="text-xs text-texto-2">{e.distrito}</p>}
                  </div>
                  <Editar>
                    <form action={editarEscuela} className="space-y-2">
                      <input type="hidden" name="id" value={e.id} />
                      <label className="block">
                        <span className="etiqueta">Nombre</span>
                        <input name="nombre" required defaultValue={e.nombre} className="campo" />
                      </label>
                      <label className="block">
                        <span className="etiqueta">Distrito</span>
                        <input name="distrito" defaultValue={e.distrito ?? ""} className="campo" />
                      </label>
                      <label className="block">
                        <span className="etiqueta">Modalidad</span>
                        <select name="modalidadId" defaultValue={m.id} className="campo">
                          {arbol.map((o) => (
                            <option key={o.id} value={o.id}>{o.nombre}</option>
                          ))}
                        </select>
                      </label>
                      <button className="boton-primario w-full">Guardar</button>
                    </form>
                    <div className="mt-3 text-center">
                      <BotonBorrar
                        accion={borrarElemento}
                        campos={{ nivel: "escuela", id: e.id }}
                        texto="Borrar escuela"
                        aviso={`Se borra "${e.nombre}" con todos sus cursos, alumnos, notas, asistencias y eventos del calendario.`}
                      />
                    </div>
                  </Editar>
                </div>

                {m.formato === "eps" ? (
                  <ComisionesEps escuelaId={e.id} cursos={e.cursos} anio={anio} />
                ) : (
                  <>
                <ul className="mt-3 space-y-3">
                  {e.cursos.map((c) => (
                    <li key={c.id}>
                      <div className="flex flex-wrap items-start justify-between gap-x-3">
                        <p className="text-sm font-medium">
                          {c.anio} año · {c.cicloLectivo}
                        </p>
                        <Editar>
                          <form action={editarCurso} className="grid grid-cols-2 gap-2">
                            <input type="hidden" name="id" value={c.id} />
                            <label>
                              <span className="etiqueta">Año</span>
                              <input name="anio" required defaultValue={c.anio} className="campo" />
                            </label>
                            <label>
                              <span className="etiqueta">Ciclo lectivo</span>
                              <input name="cicloLectivo" type="number" defaultValue={c.cicloLectivo} className="campo" />
                            </label>
                            <button className="boton-primario col-span-2">Guardar</button>
                          </form>
                          <div className="mt-3 text-center">
                            <BotonBorrar
                              accion={borrarElemento}
                              campos={{ nivel: "curso", id: c.id }}
                              texto="Borrar curso"
                              aviso="Se borra el curso con sus divisiones, materias, alumnos, notas y asistencias."
                            />
                          </div>
                        </Editar>
                      </div>
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
                      {c.divisiones.length > 0 && (
                        <p className="mt-1 text-[11px] text-texto-2">Tocá la división para cambiar sus datos, materias o alumnos, o para borrarla.</p>
                      )}
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
                    <input name="anio" required placeholder="Año (1°, 2°…)" className="campo" />
                    <input name="cicloLectivo" type="number" defaultValue={anio} className="campo" />
                    <button className="boton-primario col-span-2">Crear curso</button>
                  </form>
                </Desplegable>
                  </>
                )}
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

// "Editar" chiquito a la derecha; al abrirlo, el formulario ocupa todo el ancho de abajo
function Editar({ children }: { children: React.ReactNode }) {
  return (
    <details className="group shrink-0 text-right open:basis-full open:text-left [&[open]>summary]:text-texto">
      <summary className="cursor-pointer list-none text-sm font-semibold text-texto-2">Editar</summary>
      <div className="mt-2 rounded-xl border border-borde bg-papel p-3">{children}</div>
    </details>
  );
}

type CursoArbol = Awaited<ReturnType<typeof arbolCursos>>[number]["escuelas"][number]["cursos"][number];

// En la EPS no hay cursos: las comisiones van directo en la escuela, agrupadas por ciclo lectivo
function ComisionesEps({ escuelaId, cursos, anio }: { escuelaId: number; cursos: CursoArbol[]; anio: number }) {
  const ciclos = [...new Set(cursos.map((c) => c.cicloLectivo))].sort((a, b) => b - a);
  const delCiclo = (ciclo: number) => cursos.filter((c) => c.cicloLectivo === ciclo).flatMap((c) => c.divisiones);
  const variosCiclos = ciclos.filter((c) => delCiclo(c).length > 0).length > 1;
  const cantidadEsteAnio = delCiclo(anio).length;
  return (
    <>
      <div className="mt-3 space-y-3">
        {ciclos.map((ciclo) => {
          const comisiones = delCiclo(ciclo);
          if (!comisiones.length) return null;
          return (
            <div key={ciclo}>
              {(variosCiclos || ciclo !== anio) && <p className="mb-1.5 text-xs font-semibold text-texto-2">Ciclo {ciclo}</p>}
              <div className="flex flex-wrap gap-2">
                {comisiones.map((d) => (
                  <Link key={d.id} href={`/config/division/${d.id}`} className="rounded-lg border border-borde px-3 py-1.5 text-sm">
                    {d.seccion} <span className="text-texto-2">· {d.turno}</span>
                    {d.materias.length > 0 && <span className="text-texto-2"> · {d.materias.map((a) => a.materia).join(", ")}</span>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
        {cursos.some((c) => c.divisiones.length > 0) && (
          <p className="text-[11px] text-texto-2">Tocá la comisión para cambiar sus datos, materias o estudiantes, o para borrarla.</p>
        )}
      </div>
      <Desplegable texto="+ Comisión">
        <form action={crearComision} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="escuelaId" value={escuelaId} />
          <label className="col-span-2">
            <span className="etiqueta">Nombre</span>
            <input name="seccion" required defaultValue={`Comisión ${cantidadEsteAnio + 1}`} className="campo" />
          </label>
          <label>
            <span className="etiqueta">Turno</span>
            <select name="turno" className="campo" defaultValue="Mañana">
              {TURNOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiqueta">Ciclo lectivo</span>
            <input name="cicloLectivo" type="number" defaultValue={anio} className="campo" />
          </label>
          <input name="preceptor" placeholder="Coordinador/a" className="campo col-span-2" />
          <button className="boton-primario col-span-2">Crear comisión</button>
        </form>
      </Desplegable>
    </>
  );
}
