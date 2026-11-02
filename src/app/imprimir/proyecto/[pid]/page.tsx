// Proyecto (salida, laboratorio u otro) en hoja A4, listo para imprimir o guardar como PDF
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigirDocente } from "@/lib/auth";
import { datosProyecto } from "@/lib/proyectos";
import { armarProyecto } from "@/lib/proyectos-formato";
import { BotonImprimir } from "@/components/boton-imprimir";

export const metadata = { title: "Proyecto" };

export default function Imprimir(props: PageProps<"/imprimir/proyecto/[pid]">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Cargando…</p>}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

const borde = "border border-black";

async function Contenido({ params }: { params: Promise<{ pid: string }> }) {
  await exigirDocente();
  const pid = Number((await params).pid);
  const d = await datosProyecto(pid);
  if (!d) notFound();
  const a = armarProyecto(d);
  const hoja =
    "mx-auto mb-4 w-[794px] bg-white px-14 py-12 text-[12px] leading-snug text-black shadow print:mb-0 print:w-auto print:p-0 print:shadow-none";
  const fuente = { fontFamily: "Cambria, Georgia, 'Times New Roman', serif" };

  return (
    <div className="min-h-full bg-neutral-200 print:bg-white">
      <style>{`@page { size: A4; margin: 15mm; } @media print { html, body { background: white !important; } }`}</style>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-neutral-300 bg-white px-4 py-2 text-sm text-black print:hidden">
        <Link href={`/materias/${d.p.asignacionId}/proyectos/${pid}`} className="font-semibold">← Volver</Link>
        <span className="flex gap-2">
          <a href={`/api/proyectos/${pid}`} className="rounded-lg border border-neutral-400 px-3 py-1.5 font-semibold">Word</a>
          <BotonImprimir />
        </span>
      </div>

      <div className="overflow-x-auto p-4 print:overflow-visible print:p-0">
        <section className={`${hoja} ${a.nomina.length ? "print:break-after-page" : ""}`} style={fuente}>
          <p className="text-center text-[15px] font-bold">{a.escuela}</p>
          {a.distrito && <p className="text-center">{a.distrito}</p>}
          <p className="mt-4 text-center text-[16px] font-bold uppercase">{a.documento}</p>
          <p className="mb-4 text-center text-[14px] font-bold italic">“{a.titulo}”</p>

          <table className="mb-3 w-full table-fixed border-collapse">
            <tbody>
              {Array.from({ length: Math.ceil(a.datos.length / 2) }, (_, i) => a.datos.slice(i * 2, i * 2 + 2)).map((fila, i) => (
                <tr key={i}>
                  {fila.map(([k, v]) => (
                    <td key={k} className={`${borde} px-2 py-1 align-top`}>
                      <span className="font-bold">{k}:</span> {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {a.partes.map((parte) => (
            <table key={parte.titulo} className="w-full border-collapse">
              <tbody>
                <tr><td className={`${borde} bg-[#d9d9d9] px-2 py-0.5 font-bold`}>{parte.titulo}</td></tr>
                <tr>
                  <td className={`${borde} px-2 py-1 align-top`}>
                    {parte.lista ? (
                      <ul className="list-disc pl-5">{parte.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    ) : (
                      parte.parrafos.map((t, i) => <p key={i} className="text-justify indent-6">{t}</p>)
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          ))}

          <div className="mt-16 grid grid-cols-2 gap-12 text-center">
            <p className="border-t border-black pt-1">Firma del/la docente</p>
            <p className="border-t border-black pt-1">Firma y sello del equipo directivo</p>
          </div>
        </section>

        {a.nomina.length > 0 && (
          <section className={hoja} style={fuente}>
            <p className="text-center text-[14px] font-bold">Nómina de estudiantes</p>
            <p className="mb-3 text-center">“{a.titulo}” · {a.datos[2][1]} · {a.escuela}</p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#d9d9d9]">
                  <th className={`${borde} w-10 px-1`}>N°</th>
                  <th className={`${borde} px-2 text-left`}>Apellido y nombre</th>
                  <th className={`${borde} w-32 px-2`}>DNI</th>
                  <th className={`${borde} w-40 px-2`}>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {a.nomina.map((e) => (
                  <tr key={e.n}>
                    <td className={`${borde} px-1 text-center`}>{e.n}</td>
                    <td className={`${borde} px-2`}>{e.apellidoNombre}</td>
                    <td className={borde} />
                    <td className={borde} />
                  </tr>
                ))}
              </tbody>
            </table>
            {a.responsables.length > 0 && (
              <>
                <p className="mt-4 font-bold">Docentes responsables y acompañantes</p>
                <ul className="list-disc pl-5">{a.responsables.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
