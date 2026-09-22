import { NextResponse } from "next/server";
import { getDb, pendingUploadFor, storage, LocalDiskStorage } from "@fletcher/api";
import { getAuthUser } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Local-driver uploads only. The browser first reserves a row with
 * files.createUpload, then posts the bytes here with that fileId; under the
 * Supabase driver the bytes go straight to a signed URL and this returns 404.
 */
export async function POST(req: Request) {
  if (storage.driver !== "local") return NextResponse.json({ error: "not available" }, { status: 404 });
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const fileId = String(form.get("fileId") ?? "");
  if (!(file instanceof File) || !fileId) return NextResponse.json({ error: "file and fileId required" }, { status: 400 });

  const row = await pendingUploadFor(getDb(), fileId, auth.email);
  if (!row) return NextResponse.json({ error: "no such upload" }, { status: 404 });

  await (storage as unknown as LocalDiskStorage).write(row.storageKey, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true });
}
