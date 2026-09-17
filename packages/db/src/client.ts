import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "./env";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __fletcherSql: ReturnType<typeof postgres> | undefined;
}

export function createDb(url = requireEnv("DATABASE_URL")) {
  const sql = globalThis.__fletcherSql ?? postgres(url, { max: 10, prepare: false });
  if (process.env.NODE_ENV !== "production") globalThis.__fletcherSql = sql;
  return { db: drizzle(sql, { schema }), sql };
}

export type Db = ReturnType<typeof createDb>["db"];
