"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

// Formulario de "Editar": al guardar muestra "Guardando…", cierra el desplegable donde está y avisa "Guardado ✓"
export function FormGuardar({
  accion,
  className,
  children,
}: {
  accion: (form: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, setEstado] = useState<"" | "ok" | "error">("");
  return (
    <form
      ref={ref}
      className={className}
      action={async (fd) => {
        setEstado("");
        try {
          await accion(fd);
          setEstado("ok");
          const desplegable = ref.current?.closest("details");
          // un ratito para que se vea el "Guardado ✓" antes de cerrar
          setTimeout(() => desplegable?.removeAttribute("open"), 600);
        } catch {
          setEstado("error");
        }
      }}
      onChange={() => setEstado("")}
    >
      {children}
      {estado === "ok" && <p className="col-span-full text-center text-sm text-presente">Guardado ✓</p>}
      {estado === "error" && <p className="col-span-full text-center text-sm text-ausente">No se pudo guardar. Revisá los datos y probá de nuevo.</p>}
    </form>
  );
}

export function BotonGuardar({ texto = "Guardar", className = "boton-primario w-full" }: { texto?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? "Guardando…" : texto}
    </button>
  );
}
