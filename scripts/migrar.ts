/*
 * Aplica las migraciones a la base que indiquen TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
 * (o a local.db si no están) y muestra el resultado o el error completo.
 * Uso: npm run db:migrar
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL?.trim() || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

async function main() {
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
