import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
