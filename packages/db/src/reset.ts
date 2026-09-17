import { createDb } from "./client";

const { sql } = createDb();
await sql`drop schema if exists public cascade`;
await sql`create schema public`;
await sql`drop schema if exists drizzle cascade`;
await sql.end();
console.log("database reset");
