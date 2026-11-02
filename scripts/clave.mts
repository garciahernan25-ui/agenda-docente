/*
 * Genera el hash de tu contraseña y un SESSION_SECRET y los guarda en .env.local
 * (si el archivo no existe lo crea; si existe, reemplaza solo esas dos líneas).
 * Uso: npm run clave -- "mi contraseña"
 *      npm run clave -- "mi contraseña" "Mi Nombre"   (también guarda DOCENTE_NOMBRE)
 *      npm run clave -- "otra contraseña" "Otro Nombre" --mostrar
 *        (no toca .env.local: muestra los valores para pegarlos en otro proyecto de Vercel, ej. la agenda de otra docente)
 */
import { randomBytes, scrypt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const args = process.argv.slice(2);
const mostrar = args.includes("--mostrar");
const [clave, nombre] = args.filter((a) => a !== "--mostrar");
if (!clave || clave.length < 8) {
  console.error('Uso: npm run clave -- "tu contraseña" (mínimo 8 caracteres)');
  process.exit(1);
}
const salt = randomBytes(16);
const h = (await promisify(scrypt)(clave, salt, 32)) as Buffer;

const valores: Record<string, string> = {
  AGENDA_CLAVE_HASH: `scrypt:${salt.toString("hex")}:${h.toString("hex")}`,
  SESSION_SECRET: randomBytes(32).toString("hex"),
};
if (nombre) valores.DOCENTE_NOMBRE = nombre;

if (mostrar) {
  console.log("Pegá estos valores en las variables del proyecto de Vercel (no se guardaron en ningún archivo):\n");
  for (const [k, v] of Object.entries(valores)) console.log(`${k}=${v}`);
  process.exit(0);
}

const archivo = ".env.local";
let lineas = existsSync(archivo)
  ? readFileSync(archivo, "utf8").replace(/^﻿/, "").split(/\r?\n/)
  : ["TURSO_DATABASE_URL=", "TURSO_AUTH_TOKEN=", "DOCENTE_NOMBRE="];
for (const [k, v] of Object.entries(valores)) {
  const i = lineas.findIndex((l) => l.startsWith(`${k}=`));
  if (i >= 0) lineas[i] = `${k}=${v}`;
  else lineas.push(`${k}=${v}`);
}
lineas = lineas.filter((l, i) => l !== "" || i < lineas.length - 1);
writeFileSync(archivo, lineas.join("\n") + "\n", "utf8");
console.log(`Listo: contraseña guardada en ${archivo}${nombre ? ` (docente: ${nombre})` : ""}.`);
