import { connection } from "next/server";

// Le confirma a Android que el APK (armado con PWABuilder) es de esta página, así se abre sin la barra del navegador.
// Se configura con ANDROID_PACKAGE (ej. ar.agenda.docente) y ANDROID_SHA256 (la huella que da PWABuilder).
export async function GET() {
  await connection(); // se lee en cada pedido: alcanza con cargar las variables en Vercel
  const paquete = process.env.ANDROID_PACKAGE?.trim();
  const huellas = (process.env.ANDROID_SHA256 ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const cuerpo =
    paquete && huellas.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: paquete, sha256_cert_fingerprints: huellas },
          },
        ]
      : [];
  return Response.json(cuerpo, { headers: { "Cache-Control": "public, max-age=3600" } });
}
