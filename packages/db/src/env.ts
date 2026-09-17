import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(REPO_ROOT, ".env") });

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. Copy .env.example to .env at the repo root.`);
  return v;
}
