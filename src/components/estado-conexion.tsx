"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { actualizarDatos, borrarErrores, enviarPendientes, errores, EVENTO, pendientes, type ErrorEnvio } from "@/lib/pendientes";

// Cartelito arriba: sin señal, cambios por mandar, o algo que no se pudo guardar.
// Además, cada vez que hay internet manda lo pendiente y actualiza lo que el celu guarda para usar sin señal.
export function EstadoConexion() {
  const router = useRouter();
  const [enLinea, setEnLinea] = useState(true);
  const [cola, setCola] = useState(0);
  const [fallas, setFallas] = useState<ErrorEnvio[]>([]);
  const [sinSesion, setSinSesion] = useState(false);
  const [mandando, setMandando] = useState(false);

  useEffect(() => {
    const leerEstado = () => {
      setEnLinea(navigator.onLine);
      setCola(pendientes().length);
      setFallas(errores());
    };
    const sincronizar = async () => {
      leerEstado();
      if (!navigator.onLine) return;
      if (pendientes().length) {
        setMandando(true);
        const r = await enviarPendientes();
        setMandando(false);
        setSinSesion(!!r.sinSesion);
        if (r.enviados) router.refresh();
      }
      await actualizarDatos();
      leerEstado();
    };
    const alVolver = () => document.visibilityState === "visible" && sincronizar();
    sincronizar();
    window.addEventListener("online", sincronizar);
    window.addEventListener("offline", leerEstado);
    window.addEventListener(EVENTO, leerEstado);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener("online", sincronizar);
      window.removeEventListener("offline", leerEstado);
      window.removeEventListener(EVENTO, leerEstado);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [router]);

  if (fallas.length) {
    return (
      <div className="-mx-4 bg-ausente-bg px-4 py-2 text-sm text-ausente">
        <p className="font-semibold">Algunos cambios cargados sin señal no se pudieron guardar:</p>
        <ul className="list-disc pl-5">
          {fallas.slice(-5).map((f, i) => (
            <li key={i}>
              {f.descripcion}: {f.error}
            </li>
          ))}
        </ul>
        <button onClick={() => { borrarErrores(); setFallas([]); }} className="mt-1 font-semibold underline">
          Entendido
        </button>
      </div>
    );
  }
  if (!enLinea || cola || sinSesion) {
    return (
      <div className={`-mx-4 px-4 py-1.5 text-center text-xs font-semibold ${enLinea ? "bg-tarde-bg text-tarde" : "bg-justif-bg text-justif"}`}>
        {sinSesion
          ? `Hay ${cola} ${cola === 1 ? "cambio" : "cambios"} sin mandar: volvé a ingresar con tu contraseña y se mandan solos.`
          : !enLinea
            ? cola
              ? `Sin señal · ${cola} ${cola === 1 ? "cambio guardado" : "cambios guardados"} en el celu`
              : "Sin señal · podés tomar asistencia y cargar notas igual"
            : mandando
              ? "Mandando lo que cargaste sin señal…"
              : `${cola} ${cola === 1 ? "cambio" : "cambios"} sin mandar todavía`}
      </div>
    );
  }
  return null;
}
