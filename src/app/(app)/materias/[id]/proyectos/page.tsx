import Link from "next/link";
import { Suspense } from "react";
import { Cargando, Encabezado, Vacio } from "@/components/ui";
import { TIPOS_PROYECTO } from "@/db/constantes";
import { exigirDocente } from "@/lib/auth";
import { fechaCortaMayus } from "@/lib/fechas";
import { cabecera } from "@/lib/planillas";
import { proyectosDe } from "@/lib/proyectos";
import { NOMBRE_TIPO_PROYECTO } from "@/lib/proyectos-textos";
import { crearProyecto } from "./acciones";

export default function Proyectos(props: PageProps<"/materias/[id]/proyectos">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const [cab, lista] = await Promise.all([cabecera(id), proyectosDe(id)]);
  const eps = cab.modalidad.formato === "eps";
  return (
    <>
      <Encabezado
        titulo="Proyectos"
        subtitulo={`${eps ? "Nivel " : ""}${cab.curso.anio} ${cab.div.seccion} · ${cab.asig.materia}`}
        volver={`/materias/${id}`}
      />

      <form action={crearProyecto} className="tarjeta space-y-2 p-4">
        <input type="hidden" name="asignacionId" value={id} />
        <p className="font-semibold">Nuevo proyecto</p>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-borde bg-hoja p-0.5 text-sm font-semibold">
          {TIPOS_PROYECTO.map((t, i) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" name="tipo" value={t} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block rounded-lg px-2 py-1.5 text-center text-texto-2 peer-checked:bg-tinta peer-checked:text-hoja">
                {t === "salida" ? "Salida" : t === "laboratorio" ? "Laboratorio" : "Otro"}
              </span>
            </label>
          ))}
        </div>
        <input name="titulo" required placeholder="Título (Visita al Planetario)" className="campo" />
        <button className="boton-primario w-full">Crear y completar</button>
      </form>

      <h2 className="titulo-seccion">Mis proyectos</h2>
      {lista.length === 0 ? (
        <Vacio>Todavía no armaste ninguno.</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-borde">
          {lista.map((p) => (
            <li key={p.id}>
              <Link href={`/materias/${id}/proyectos/${p.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.titulo}</span>
                  <span className="text-xs text-texto-2">
                    {NOMBRE_TIPO_PROYECTO[p.tipo]}
                    {p.fecha ? ` · ${fechaCortaMayus(p.fecha)}` : " · sin fecha"}
                  </span>
                </span>
                <span className="text-texto-2">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
