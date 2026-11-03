import { Suspense } from "react";
import { EstadoConexion } from "@/components/estado-conexion";
import { BarraInferior } from "@/components/navegacion";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28">
        <EstadoConexion />
        {children}
      </main>
      {/* La barra marca la sección actual leyendo la URL: se resuelve al navegar */}
      <Suspense fallback={<BarraInferior sinRuta />}>
        <BarraInferior />
      </Suspense>
    </>
  );
}
