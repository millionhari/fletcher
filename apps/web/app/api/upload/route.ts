import { NextResponse } from "next/server";
import sharp from "sharp";
import { storage } from "@fletcher/api";

export const runtime = "nodejs";

/**
 * Multipart upload → local disk. Returns metadata the client then attaches
 * via deliverables.addVersion. Image dimensions are probed server-side with sharp;
 * video duration/dimensions come from the client (HTML5 metadata) as form fields.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file missing" }, { status: 400 });
  const folder = String(form.get("folder") ?? "uploads").replace(/[^a-z0-9/_-]/gi, "");
  const data = Buffer.from(await file.arrayBuffer());
  const stored = await storage.put({ data, fileName: file.name, folder: folder || "uploads" });

  let width: number | null = null;
  let height: number | null = null;
  if (file.type.startsWith("image/")) {
    try {
      const meta = await sharp(data).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      /* not a readable image */
    }
  } else {
    const w = Number(form.get("width"));
    const h = Number(form.get("height"));
    width = Number.isFinite(w) && w > 0 ? Math.round(w) : null;
    height = Number.isFinite(h) && h > 0 ? Math.round(h) : null;
  }
  const d = Number(form.get("durationSeconds"));
  const durationSeconds = Number.isFinite(d) && d > 0 ? d : null;

  return NextResponse.json({
    storageKey: stored.storageKey,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: stored.bytes,
    width,
    height,
    durationSeconds,
    publicUrl: storage.publicUrl(stored.storageKey),
  });
}
