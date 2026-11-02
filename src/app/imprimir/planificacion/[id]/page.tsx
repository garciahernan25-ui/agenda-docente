// Réplica del modelo de Planificación Anual (hoja carta apaisada, tres páginas), lista para imprimir o guardar como PDF
import Link from "next/link";
import { Suspense } from "react";
import { exigirDocente } from "@/lib/auth";
import { datosPlanificacion, numerarUnidades, renglones, type DatosPlanificacion } from "@/lib/planificacion";
import { BotonImprimir } from "@/components/boton-imprimir";

export const metadata = { title: "Planificación anual" };

export default function Imprimir(props: PageProps<"/imprimir/planificacion/[id]">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Cargando…</p>}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const d = await datosPlanificacion(id);
  return (
    <div className="min-h-full bg-neutral-200 print:bg-white">
      <style>{`@page { size: letter landscape; margin: 10mm; } @media print { html, body { background: white !important; } }`}</style>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-neutral-300 bg-white px-4 py-2 text-sm text-black print:hidden">
        <Link href={`/materias/${id}/planificacion`} className="font-semibold">← Volver</Link>
        <span className="flex gap-2">
          <a href={`/api/asignaciones/${id}/planificacion`} className="rounded-lg border border-neutral-400 px-3 py-1.5 font-semibold">Word</a>
          <BotonImprimir />
        </span>
      </div>
      <div className="overflow-x-auto p-4 print:overflow-visible print:p-0">
        <Hojas d={d} />
      </div>
    </div>
  );
}

const borde = "border border-black";
const titulo = `${borde} bg-[#d9d9d9] px-2 py-0.5 text-center font-bold italic`;
const celda = `${borde} px-2 py-1 align-top`;

function Hoja({ children, ultima = false }: { children: React.ReactNode; ultima?: boolean }) {
  return (
    <section
      className={`mx-auto mb-4 w-[1000px] bg-white p-6 text-[11px] leading-snug text-black shadow print:mb-0 print:w-auto print:p-0 print:shadow-none ${ultima ? "" : "print:break-after-page"}`}
      style={{ fontFamily: "Cambria, Georgia, 'Times New Roman', serif" }}
    >
      {children}
    </section>
  );
}

function Cabecera({ d, escuela = false }: { d: DatosPlanificacion; escuela?: boolean }) {
  const { cab, contenido } = d;
  const eps = cab.modalidad.formato === "eps";
  return (
    <>
      {escuela && <p className="mb-1 text-center text-[15px] font-bold italic">{cab.escuela.nombre}</p>}
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td colSpan={5} className={`${borde} text-center font-bold`}>Planificación Anual</td>
          </tr>
          <tr>
            <td className={`${celda} w-[20%]`}>Docente:<br />{cab.asig.profesor}</td>
            <td className={`${celda} w-[14%]`}>
              Curso: {eps ? "Nivel " : ""}{cab.curso.anio} {cab.div.seccion}<br />Turno: {cab.div.turno}
            </td>
            <td className={`${celda} w-[16%]`}>Carga horaria<br />{contenido.cargaHoraria}</td>
            <td className={`${celda} w-[30%]`}>Espacio Curricular:<br />{cab.asig.materia}</td>
            <td className={celda}>Ciclo lectivo:<br />{cab.curso.cicloLectivo}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Vinetas({ texto, intro }: { texto?: string; intro?: string }) {
  const items = renglones(texto);
  return (
    <>
      {intro && <p className="font-semibold">{intro}</p>}
      <ul className="list-disc pl-5">
        {items.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </>
  );
}

function Bloque({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        <tr><td className={titulo}>{nombre}</td></tr>
        <tr><td className={celda}>{children}</td></tr>
      </tbody>
    </table>
  );
}

function Hojas({ d }: { d: DatosPlanificacion }) {
  const { contenido: c } = d;
  const unidades = numerarUnidades(d.unidades);
  const parrafos = (c.fundamentacion ?? "").split(/\r?\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <Hoja>
        <Cabecera d={d} escuela />
        <Bloque nombre="Fundamentación">
          {parrafos.map((p, i) => <p key={i} className="text-justify indent-6">{p}</p>)}
        </Bloque>
        <Bloque nombre="Objetivos de Enseñanza">
          <Vinetas texto={c.objetivosEnsenanza} intro="Se espera que el/la docente pueda:" />
        </Bloque>
        <Bloque nombre="Objetivos de Aprendizaje">
          <Vinetas texto={c.objetivosAprendizaje} intro="Se espera que el estudiante logre:" />
        </Bloque>
      </Hoja>

      <Hoja>
        <Cabecera d={d} />
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr>
              <td className={titulo}>Primer cuatrimestre</td>
              <td className={titulo}>Segundo cuatrimestre</td>
            </tr>
            <tr>
              {([1, 2] as const).map((cuatri) => (
                <td key={cuatri} className={celda}>
                  {unidades.filter((u) => u.cuatrimestre === cuatri).map((u) => (
                    <div key={u.numero} className="mb-2">
                      <p className="font-bold">
                        Unidad n°{u.numero}: “{u.titulo}”{u.eje ? ` - ${u.eje}` : ""}
                      </p>
                      <p className="whitespace-pre-line text-justify">{u.contenidos}</p>
                    </div>
                  ))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr>
              <td className={titulo}>Estrategias didácticas. Actividades</td>
              <td className={titulo}>Recursos</td>
              <td className={titulo}>Sistema evaluativo</td>
              <td className={titulo}>Criterios de evaluación</td>
            </tr>
            <tr>
              <td className={celda}><Vinetas texto={c.estrategias} intro="Se propondrá:" /></td>
              <td className={celda}><Vinetas texto={c.recursos} intro="Para el desarrollo de las clases se utilizarán:" /></td>
              <td className={celda}><Vinetas texto={c.sistemaEvaluativo} /></td>
              <td className={celda}><Vinetas texto={c.criterios} /></td>
            </tr>
          </tbody>
        </table>
      </Hoja>

      <Hoja ultima>
        <Cabecera d={d} />
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr><td colSpan={2} className={titulo}>Bibliografía</td></tr>
            <tr>
              <td className={celda}><Vinetas texto={c.bibliografiaDocente} intro="Bibliografía para el docente:" /></td>
              <td className={celda}><Vinetas texto={c.bibliografiaEstudiante} intro="Bibliografía para el estudiante:" /></td>
            </tr>
            <tr>
              <td className={titulo}>Proyectos institucionales/Salidas educativas etc</td>
              <td className={titulo}>Observaciones</td>
            </tr>
            <tr>
              <td className={celda}><Vinetas texto={c.proyectos} /></td>
              <td className={celda}><Vinetas texto={c.observaciones} /></td>
            </tr>
          </tbody>
        </table>
        <div className="mt-8 grid grid-cols-2">
          <p>Fecha de entrega: {c.fechaEntrega ? c.fechaEntrega.split("-").reverse().join("/") : ""}</p>
          <p>Recepción:</p>
        </div>
      </Hoja>
    </>
  );
}
