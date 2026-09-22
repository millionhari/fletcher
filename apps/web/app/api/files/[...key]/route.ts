import { NextResponse } from "next/server";
import { fileAccessFor, getDb, storage } from "@fletcher/api";
import { getAuthUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", pdf: "application/pdf" };

/**
 * Every stored file is read through here. The URL is stable (safe to cache in
 * React Query and to put in an <img>), and the route checks that the caller is
 * a member of the file's workspace before handing over the bytes — streamed
 * from disk locally, or a 302 to a ten-minute signed URL on Supabase.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key } = await ctx.params;
  const storageKey = key.join("/");
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { file, allowed } = await fileAccessFor(getDb(), storageKey, auth.email);
  if (!file && !allowed) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const signed = await storage.signedReadUrl(storageKey, 600);
  if (signed) return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });

  try {
    const data = await storage.read(storageKey);
    const ext = storageKey.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": file?.mimeType ?? TYPES[ext] ?? "application/octet-stream", "Cache-Control": "private, max-age=3600", "Content-Length": String(data.byteLength) },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
