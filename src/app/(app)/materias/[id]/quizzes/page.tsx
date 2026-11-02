import Link from "next/link";
import { Suspense } from "react";
import { Cargando, Encabezado } from "@/components/ui";
import { exigirDocente } from "@/lib/auth";
import { cabecera } from "@/lib/planillas";
import { leerQuizzes, planQuizzes } from "@/lib/quizzes";
import { PanelQuizzes } from "./panel";

export default function Quizzes(props: PageProps<"/materias/[id]/quizzes">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

const MOTIVO = {
  "sin-config": "Todavía no está conectada con la página de quizzes. Faltan QUIZZES_URL y QUIZZES_TOKEN en la configuración de la app (en Vercel).",
  token: "La página de quizzes rechazó el token. Revisá que QUIZZES_TOKEN de la agenda sea igual a AGENDA_TOKEN de quizzes.",
  error: "No se pudo leer la página de quizzes. Probá de nuevo en un rato.",
} as const;

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await exigirDocente();
  const id = Number((await params).id);
  const lectura = await leerQuizzes();
  if (!lectura.ok) {
    const cab = await cabecera(id);
    return (
      <>
        <Encabezado titulo="Notas de quizzes" subtitulo={`${cab.curso.anio} ${cab.div.seccion} · ${cab.asig.materia}`} volver={`/materias/${id}`} />
        <p className="tarjeta p-4 text-sm">{MOTIVO[lectura.motivo]}</p>
      </>
    );
  }
  const plan = await planQuizzes(id, lectura.datos);
  const { cab } = plan;
  const conQuiz = plan.temasConQuiz.filter((t) => t.quiz);
  const sinQuiz = plan.temasConQuiz.filter((t) => !t.quiz);

  return (
    <>
      <Encabezado titulo="Notas de quizzes" subtitulo={`${cab.curso.anio} ${cab.div.seccion} · ${cab.asig.materia}`} volver={`/materias/${id}`} />

      <h2 className="titulo-seccion">Temas con quiz del mismo nombre</h2>
      {plan.temasConQuiz.length === 0 ? (
        <p className="tarjeta p-4 text-sm text-texto-2">
          Esta materia no tiene temas todavía.{" "}
          <Link href={`/materias/${id}/temas`} className="font-semibold text-tinta">Crear temas</Link>
        </p>
      ) : (
        <ul className="tarjeta divide-y divide-borde text-sm">
          {conQuiz.map((t) => (
            <li key={t.temaId} className="flex items-center gap-2 px-4 py-2.5">
              <span className="text-presente">✓</span>
              <span className="flex-1">{t.titulo}</span>
              <span className="text-xs text-texto-2">{t.cuatrimestre}° C</span>
            </li>
          ))}
          {sinQuiz.map((t) => (
            <li key={t.temaId} className="flex items-center gap-2 px-4 py-2.5 text-texto-2">
              <span>–</span>
              <span className="flex-1">{t.titulo}</span>
              <span className="text-xs">sin quiz con ese nombre</span>
            </li>
          ))}
        </ul>
      )}
      {sinQuiz.length > 0 && (
        <p className="mt-1 text-xs text-texto-2">
          Para que un tema traiga notas, el quiz tiene que llamarse igual (no importan mayúsculas ni tildes).
        </p>
      )}

      <PanelQuizzes
        asignacionId={id}
        estudiantes={plan.estudiantes}
        candidatos={plan.candidatos}
        cambios={plan.cambios.map((c) => ({
          inscripcionId: c.inscripcionId,
          tema: plan.temasConQuiz.find((t) => t.temaId === c.temaId)?.titulo ?? "",
          valor: c.valor,
          antes: c.antes,
        }))}
        hayTemasConQuiz={conQuiz.length > 0}
      />
    </>
  );
}
