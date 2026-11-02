import { Suspense } from "react";
import { redirect } from "next/navigation";

// La pantalla vieja de PDFs ahora es la Planilla de notas
export default function Planillas(props: PageProps<"/materias/[id]/planillas">) {
  return (
    <Suspense>
      <Redirigir params={props.params} />
    </Suspense>
  );
}

async function Redirigir({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/materias/${id}/planilla`);
  return null;
}
