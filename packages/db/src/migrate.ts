import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "./client";

const { db, sql } = createDb();
await migrate(db, { migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle") });
await sql.end();
console.log("migrations applied");
