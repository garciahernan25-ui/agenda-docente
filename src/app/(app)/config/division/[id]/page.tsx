import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { alumnos, asignaciones, cursos, divisiones, escuelas, inscripciones, modalidades, notas, pesos, TURNOS, NIVELES_EPS } from "@/db/schema";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { listarMaterias } from "@/lib/consultas";
import { armarTipos } from "@/lib/tipos-comun";
import { EditorTipos } from "./tipos";
import { FotoLista } from "./foto-lista";
import { BotonBorrar } from "@/components/boton-borrar";
import { nombreGrupo, textosGrupo } from "@/lib/grupo";
import { actualizarInscripcion, agregarAlumnos, asignarNivelATodos, borrarAlumno, borrarElemento, crearMateria, guardarDivision, guardarMateria } from "../../actions";
import { BotonGuardar, FormGuardar } from "@/components/form-guardar";

export default function Division(props: PageProps<"/config/division/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const [d] = await db
    .select({ div: divisiones, curso: cursos, escuela: escuelas, modalidad: modalidades })
    .from(divisiones)
    .innerJoin(cursos, eq(divisiones.cursoId, cursos.id))
    .innerJoin(escuelas, eq(cursos.escuelaId, escuelas.id))
    .innerJoin(modalidades, eq(escuelas.modalidadId, modalidades.id))
    .where(eq(divisiones.id, id));
  if (!d) notFound();
  const eps = d.modalidad.formato === "eps";
  const t = textosGrupo(d.modalidad.formato);
  const [lista, materias, pesosRows] = await Promise.all([
    db
      .select({ insc: inscripciones, alumno: alumnos })
      .from(inscripciones)
      .innerJoin(alumnos, eq(inscripciones.alumnoId, alumnos.id))
      .where(eq(inscripciones.divisionId, id))
      .orderBy(asc(inscripciones.orden)),
    db.select().from(asignaciones).where(eq(asignaciones.divisionId, id)),
    db.select().from(pesos),
  ]);
  const idsMaterias = materias.map((m) => m.id);
  const [categoriasConNotas, todasLasMaterias] = await Promise.all([
    idsMaterias.length
      ? db.selectDistinct({ asignacionId: notas.asignacionId, categoria: notas.categoria }).from(notas).where(inArray(notas.asignacionId, idsMaterias))
      : Promise.resolve([] as { asignacionId: number; categoria: string }[]),
    listarMaterias(),
  ]);

  return (
    <>
      <Encabezado
        titulo={`${nombreGrupo(d.modalidad.formato, d.curso.anio, d.div.seccion)} · ${d.div.turno}`}
        subtitulo={`${d.escuela.nombre} · ${d.curso.cicloLectivo}`}
        volver="/config"
      />

      <details className="tarjeta p-4">
        <summary className="cursor-pointer text-sm font-semibold">Datos de la {t.grupo}</summary>
        <FormGuardar accion={guardarDivision} className="mt-3 grid grid-cols-2 gap-2">
          <input type="hidden" name="id" value={id} />
          {!eps && (
            <label>
              <span className="etiqueta">Año</span>
              <input name="anio" required defaultValue={d.curso.anio} className="campo" />
            </label>
          )}
          <label className={eps ? "col-span-2" : ""}>
            <span className="etiqueta">{eps ? "Nombre" : "División"}</span>
            <input name="seccion" defaultValue={d.div.seccion} className="campo" />
          </label>
          <label className="col-span-2">
            <span className="etiqueta">Turno</span>
            <select name="turno" defaultValue={d.div.turno} className="campo">
              {TURNOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="col-span-2">
            <span className="etiqueta">{t.responsable}</span>
            <input name="preceptor" defaultValue={d.div.preceptor ?? ""} className="campo" />
          </label>
          <BotonGuardar className="boton-primario col-span-2" texto="Guardar" />
        </FormGuardar>
        <div className="mt-3 text-center">
          <BotonBorrar
            accion={borrarElemento}
            campos={{ nivel: "division", id, volver: "/config" }}
            texto={`Borrar esta ${t.grupo}`}
            aviso={`Se borra la ${t.grupo} con sus materias, ${eps ? "estudiantes" : "alumnos"}, notas, asistencias y cierres.`}
          />
        </div>
      </details>

      <h2 className="titulo-seccion">Materias</h2>
      <div className="space-y-3">
        {materias.map((m) => {
          return (
            <details key={m.id} className="tarjeta p-4">
              <summary className="cursor-pointer font-semibold">
                {m.materia} <span className="text-sm font-normal text-texto-2">· {m.profesor}</span>
              </summary>
              <FormGuardar accion={guardarMateria} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={m.id} />
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2">
                    <span className="etiqueta">Materia</span>
                    <input name="materia" defaultValue={m.materia} className="campo" />
                  </label>
                  <label className="col-span-2">
                    <span className="etiqueta">Profesor/a</span>
                    <input name="profesor" defaultValue={m.profesor} className="campo" />
                  </label>
                  <label>
                    <span className="etiqueta">Clases previstas 1° C</span>
                    <input name="totalClases1" type="number" min={0} defaultValue={m.totalClases1 ?? ""} className="campo" />
                  </label>
                  <label>
                    <span className="etiqueta">Clases previstas 2° C</span>
                    <input name="totalClases2" type="number" min={0} defaultValue={m.totalClases2 ?? ""} className="campo" />
                  </label>
                </div>
                {eps && (
                  <fieldset>
                    <legend className="etiqueta">Encabezado del RITE y del Plan formativo (EPS)</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["eps_area", "Área", m.datosEps?.area, "Ciencias Naturales"],
                          ["eps_familia", "Familia profesional", m.datosEps?.familiaProfesional, "Energías eléctricas"],
                          ["eps_region", "Región", m.datosEps?.region, "V"],
                          ["eps_sede", "Sede", m.datosEps?.sede, ""],
                          ["eps_cfp", "CFP que articula", m.datosEps?.cfp, ""],
                          ["eps_oferta", "Oferta", m.datosEps?.oferta, ""],
                          ["eps_correo", "Tu correo", m.datosEps?.correo, ""],
                        ] as const
                      ).map(([name, etiqueta, valor, ej]) => (
                        <label key={name} className={name === "eps_correo" || name === "eps_oferta" ? "col-span-2" : ""}>
                          <span className="text-[11px] text-texto-2">{etiqueta}</span>
                          <input name={name} defaultValue={valor ?? ""} placeholder={ej} className="campo py-2" />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <BotonGuardar className="boton-primario w-full" texto="Guardar materia" />
              </FormGuardar>
              <EditorTipos
                asignacionId={m.id}
                tipos={armarTipos(pesosRows.filter((x) => x.asignacionId === m.id))}
                conNotas={categoriasConNotas.filter((x) => x.asignacionId === m.id).map((x) => x.categoria)}
                otras={todasLasMaterias
                  .filter((o) => o.id !== m.id)
                  .map((o) => ({ id: o.id, texto: `${nombreGrupo(o.formato, o.anio, o.seccion)} · ${o.materia} · ${o.escuela}` }))}
              />
              <div className="mt-3 text-center">
                <BotonBorrar
                  accion={borrarElemento}
                  campos={{ nivel: "materia", id: m.id }}
                  texto="Borrar esta materia"
                  aviso={`Se borra ${m.materia} con sus temas, clases, notas, asistencias, cierres y eventos del calendario. ${eps ? "Los estudiantes de la comisión quedan." : "Los alumnos de la división quedan."}`}
                />
              </div>
            </details>
          );
        })}
        <details className="tarjeta p-4">
          <summary className="cursor-pointer text-sm font-semibold text-tinta">+ Materia</summary>
          <form action={crearMateria} className="mt-3 space-y-2">
            <input type="hidden" name="divisionId" value={id} />
            <input name="materia" required placeholder="Materia (Fisicoquímica)" className="campo" />
            <input name="profesor" required placeholder="Profesor/a" defaultValue={process.env.DOCENTE_NOMBRE ?? ""} className="campo" />
            <button className="boton-primario w-full">Crear materia</button>
          </form>
        </details>
      </div>

      <h2 className="titulo-seccion">{eps ? "Estudiantes" : "Alumnos"} ({lista.filter((l) => l.insc.estado === "activo").length} activos)</h2>
      {eps && lista.some((l) => l.insc.estado === "activo") && (
        <form action={asignarNivelATodos} className="tarjeta mb-2 flex flex-wrap items-center gap-2 p-3 text-sm">
          <input type="hidden" name="divisionId" value={id} />
          <span className="flex-1">Poner a todos los activos en</span>
          <select name="nivel" defaultValue="4" className="rounded-lg border border-borde bg-papel px-2 py-1.5" aria-label="Nivel para todos">
            {NIVELES_EPS.map((n) => <option key={n} value={n}>Nivel {n}</option>)}
          </select>
          <button className="boton px-3 py-1.5">Aplicar</button>
          <span className="basis-full text-xs text-texto-2">Después podés cambiarle el nivel a cada uno abriéndolo en la lista.</span>
        </form>
      )}
      <ul className="tarjeta divide-y divide-borde">
        {lista.map(({ insc, alumno }) => (
          <li key={insc.id}>
            <details className="px-4 py-2.5">
              <summary className={`flex cursor-pointer items-center gap-3 text-sm ${insc.estado === "baja" ? "text-texto-2" : ""}`}>
                <span className="w-5 text-right tabular-nums text-texto-2">{insc.orden}</span>
                <span className="flex-1">
                  {alumno.apellido}, {alumno.nombre}
                </span>
                {eps && insc.nivel && <span className="rounded bg-tinta-suave px-1.5 text-xs font-bold text-tinta">Nivel {insc.nivel}</span>}
                {insc.cursaRecursa === "R" && <span className="rounded bg-tarde-bg px-1.5 text-xs font-bold text-tarde">R</span>}
                {insc.estado === "baja" && <span className="text-xs">baja{insc.observacion ? ` · ${insc.observacion}` : ""}</span>}
              </summary>
              <FormGuardar accion={actualizarInscripcion} className="mt-2 grid grid-cols-2 gap-2 pb-1">
                <input type="hidden" name="id" value={insc.id} />
                <label>
                  <span className="text-[11px] text-texto-2">Apellido</span>
                  <input name="apellido" required defaultValue={alumno.apellido} className="campo" />
                </label>
                <label>
                  <span className="text-[11px] text-texto-2">Nombre</span>
                  <input name="nombre" defaultValue={alumno.nombre} className="campo" />
                </label>
                <select name="cursaRecursa" defaultValue={insc.cursaRecursa} className="campo">
                  <option value="C">Cursa</option>
                  <option value="R">Recursa</option>
                </select>
                <select name="estado" defaultValue={insc.estado} className="campo">
                  <option value="activo">Activo</option>
                  <option value="baja">Baja</option>
                </select>
                {eps && (
                  <>
                    <label>
                      <span className="text-[11px] text-texto-2">Nivel en que está</span>
                      <select name="nivel" defaultValue={insc.nivel ?? ""} className="campo">
                        <option value="">–</option>
                        {NIVELES_EPS.map((n) => <option key={n} value={n}>Nivel {n}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="text-[11px] text-texto-2">Empezó la EPS (mes/año)</span>
                      <input name="inicioEps" defaultValue={insc.inicioEps ?? ""} placeholder="03/2025" className="campo" />
                    </label>
                  </>
                )}
                <input name="observacion" defaultValue={insc.observacion ?? ""} placeholder="Observación (T.M, pase…)" className="campo col-span-2" />
                <BotonGuardar className="boton col-span-2" texto="Guardar" />
              </FormGuardar>
              <div className="pb-2 pt-1 text-center">
                <BotonBorrar
                  accion={borrarAlumno}
                  campos={{ id: insc.id }}
                  texto="Borrar (lo cargué por error)"
                  aviso={`Se borra a ${alumno.apellido}, ${alumno.nombre} con sus notas y asistencias, y los que siguen suben un número. Si dejó la escuela, mejor marcalo como Baja.`}
                />
              </div>
            </details>
          </li>
        ))}
        {lista.length === 0 && <li className="px-4 py-3 text-sm text-texto-2">Todavía no cargaste alumnos.</li>}
      </ul>

      <details className="tarjeta mt-3 p-4" open={lista.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-tinta">+ Pegar lista de alumnos</summary>
        <form action={agregarAlumnos} className="mt-3 space-y-2">
          <input type="hidden" name="divisionId" value={id} />
          <textarea
            name="lista"
            required
            rows={8}
            placeholder={"Uno por renglón, en el orden de la planilla:\nPÉREZ, Juan\nGÓMEZ, Ana\n…"}
            className="campo font-mono text-sm"
          />
          <p className="text-xs text-texto-2">Se agregan al final de la lista. Si alguien dejó de venir, marcalo como Baja así conserva su número en la planilla.</p>
          <button className="boton-primario w-full">Agregar alumnos</button>
        </form>
        <FotoLista divisionId={id} eps={eps} />
      </details>
    </>
  );
}
