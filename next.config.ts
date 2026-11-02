import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // La plantilla oficial se lee del disco al generar el PDF: que viaje con el deploy
  outputFileTracingIncludes: {
    "/api/asignaciones/*/planilla-calificaciones": ["./src/pdf/plantillas/**"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
