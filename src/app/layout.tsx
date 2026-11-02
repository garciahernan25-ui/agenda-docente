import type { Metadata, Viewport } from "next";
import { RegistrarSW } from "@/components/registrar-sw";
import "./globals.css";

// Tipografía del sistema: carga instantánea y funciona sin internet en el celular
export const metadata: Metadata = {
  title: "Agenda docente",
  description: "Notas, asistencia y planillas de mis cursos",
  appleWebApp: { capable: true, title: "Agenda", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
