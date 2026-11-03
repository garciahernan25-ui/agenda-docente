import type { MetadataRoute } from "next";

// Para instalarla en el celu (y para armar el APK con PWABuilder)
export default function manifest(): MetadataRoute.Manifest {
  const nombre = process.env.APP_NOMBRE?.trim() || "Agenda docente";
  return {
    id: "/",
    name: nombre,
    short_name: nombre.length > 12 ? "Agenda" : nombre,
    description: "Notas, asistencia, planillas y planificaciones de mis cursos",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f3",
    theme_color: "#223c55",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
