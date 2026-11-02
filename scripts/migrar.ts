/*
 * Aplica las migraciones a la base que indiquen TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
 * (o a local.db si no están) y muestra el resultado o el error completo.
 * Uso: npm run db:migrar
 *      npm run db:migrar:turso   (te pide la dirección y el token de Turso en la pantalla; no se guardan en ningún lado)
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createInterface } from "node:readline";

const TU_BASE = "libsql://agenda-docente-garciahernan25-ui.aws-us-east-1.turso.io";
let url = process.env.TURSO_DATABASE_URL?.trim() || "file:local.db";
let authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

// Pregunta algo en la terminal; con oculto=true no muestra lo que pegás
function preguntar(texto: string, oculto = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((ok) => {
    rl.question(texto, (r) => {
      rl.close();
      if (oculto) process.stdout.write("\n");
      ok(r.trim());
    });
    if (oculto) {
      const r = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      r._writeToOutput = (s: string) => {
        if (s.startsWith(texto)) r.output.write(texto);
        else if (s.includes("\n") || s.includes("\r")) r.output.write(s);
        else r.output.write("*".repeat(Math.min(s.length, 1)));
      };
    }
  });
}

async function main() {
  if (process.argv.includes("--turso")) {
    const u = await preguntar(`Dirección de la base (Enter = la tuya, agenda-docente): `);
    url = u || TU_BASE;
    authToken = await preguntar("Pegá el token de Turso (clic derecho para pegar) y apretá Enter: ", true);
  }
  const remota = url.startsWith("libsql://");
  console.log(`Base: ${remota ? url : "local.db (tu compu)"}`);
  if (remota && !authToken) throw new Error("Falta TURSO_AUTH_TOKEN");
  if (authToken && /PEGAR|TOKEN/.test(authToken)) throw new Error("El token parece no haberse reemplazado (dice PEGAR o TOKEN)");

  const client = createClient({ url, authToken });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  const r = await client.execute(
    "select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '\\_\\_%' escape '\\' order by name",
  );
  console.log(`Listo: migraciones aplicadas. Tablas (${r.rows.length}): ${r.rows.map((x) => x.name).join(", ")}`);
  client.close();
}

main().catch((e) => {
  console.error("\nNO se pudo migrar:");
  console.error(e?.cause?.message ?? e?.message ?? e);
  process.exit(1);
});
