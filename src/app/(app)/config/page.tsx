import Link from "next/link";
import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { TURNOS } from "@/db/schema";
import { exigirDocente } from "@/lib/auth";
import { arbolCursos } from "@/lib/consultas";
import { hoyAR } from "@/lib/fechas";
import { salir } from "@/app/login/actions";
import { BotonBorrar } from "@/components/boton-borrar";
import { borrarElemento, crearGrupo, crearEscuela, crearModalidad, editarEscuela, editarModalidad } from "./actions";
import { BotonGuardar, FormGuardar } from "@/components/form-guardar";

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
              <FormGuardar accion={editarModalidad} className="space-y-2">
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
                <BotonGuardar className="boton-primario w-full" texto="Guardar" />
              </FormGuardar>
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
                    <FormGuardar accion={editarEscuela} className="space-y-2">
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
                      <BotonGuardar className="boton-primario w-full" texto="Guardar" />
                    </FormGuardar>
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

                <GruposEscuela escuelaId={e.id} cursos={e.cursos} anio={anio} eps={m.formato === "eps"} />
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

// Los grupos de una escuela, sin el paso intermedio de "curso":
// en secundaria cada uno es año + división ("5° A"); en la EPS, una comisión. Se agrupan por ciclo lectivo.
function GruposEscuela({ escuelaId, cursos, anio, eps }: { escuelaId: number; cursos: CursoArbol[]; anio: number; eps: boolean }) {
  const ciclos = [...new Set(cursos.map((c) => c.cicloLectivo))].sort((a, b) => b - a);
  const delCiclo = (ciclo: number) =>
    cursos
      .filter((c) => c.cicloLectivo === ciclo)
      .flatMap((c) => c.divisiones.map((d) => ({ ...d, anio: c.anio })))
      .sort((x, y) => x.anio.localeCompare(y.anio, "es", { numeric: true }) || x.seccion.localeCompare(y.seccion, "es", { numeric: true }));
  const variosCiclos = ciclos.filter((c) => delCiclo(c).length > 0).length > 1;
  const cantidadEsteAnio = delCiclo(anio).length;
  const palabra = eps ? "comisión" : "curso";
  return (
    <>
      <div className="mt-3 space-y-3">
        {ciclos.map((ciclo) => {
          const grupos = delCiclo(ciclo);
          if (!grupos.length) return null;
          return (
            <div key={ciclo}>
              {(variosCiclos || ciclo !== anio) && <p className="mb-1.5 text-xs font-semibold text-texto-2">Ciclo {ciclo}</p>}
              <div className="flex flex-wrap gap-2">
                {grupos.map((d) => (
                  <Link key={d.id} href={`/config/division/${d.id}`} className="rounded-lg border border-borde px-3 py-1.5 text-sm">
                    {eps ? d.seccion : `${d.anio} ${d.seccion}`} <span className="text-texto-2">· {d.turno}</span>
                    {d.materias.length > 0 && <span className="text-texto-2"> · {d.materias.map((a) => a.materia).join(", ")}</span>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
        {cursos.some((c) => c.divisiones.length > 0) && (
          <p className="text-[11px] text-texto-2">
            Tocá {eps ? "la comisión" : "el curso"} para cambiar sus datos, materias o {eps ? "estudiantes" : "alumnos"}, o para borrarl{eps ? "a" : "o"}.
          </p>
        )}
      </div>
      <Desplegable texto={`+ ${eps ? "Comisión" : "Curso"}`}>
        <form action={crearGrupo} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="escuelaId" value={escuelaId} />
          {eps ? (
            <label className="col-span-2">
              <span className="etiqueta">Nombre</span>
              <input name="seccion" required defaultValue={`Comisión ${cantidadEsteAnio + 1}`} className="campo" />
            </label>
          ) : (
            <>
              <label>
                <span className="etiqueta">Año</span>
                <input name="anio" required placeholder="5°" className="campo" />
              </label>
              <label>
                <span className="etiqueta">División</span>
                <input name="seccion" required placeholder="A" className="campo" />
              </label>
            </>
          )}
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
          <input name="preceptor" placeholder={eps ? "Coordinador/a" : "Preceptor/a"} className="campo col-span-2" />
          <button className="boton-primario col-span-2">Crear {palabra}</button>
        </form>
      </Desplegable>
    </>
  );
}
