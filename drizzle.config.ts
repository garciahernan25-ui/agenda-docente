import { defineConfig } from "drizzle-kit";

const remoto = !!process.env.TURSO_DATABASE_URL?.trim();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: remoto ? "turso" : "sqlite",
  dbCredentials: remoto
    ? {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : { url: "file:local.db" },
});
