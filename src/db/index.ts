import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Si TURSO_DATABASE_URL no está o está vacía, usa la base local (local.db)
const url = process.env.TURSO_DATABASE_URL?.trim() || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
export { schema };
