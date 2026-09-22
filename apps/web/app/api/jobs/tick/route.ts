import { NextResponse } from "next/server";
import { getDb, runMaintenance } from "@fletcher/api";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron entry point (Vercel Cron or any scheduler). Sweeps abandoned uploads
 * and retries stuck imports. Guarded by a shared secret; Vercel Cron sends it
 * as a bearer token automatically when CRON_SECRET is set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runMaintenance(getDb());
  return NextResponse.json({ ok: true, ...result });
}
