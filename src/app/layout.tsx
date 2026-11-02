import type { Metadata } from "next";
import "./globals.css";

// Tipografía del sistema: carga instantánea y funciona sin internet en el celular
export const metadata: Metadata = {
  title: "Agenda docente",
  description: "Notas, asistencia y planillas de mis cursos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
