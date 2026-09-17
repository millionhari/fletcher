import { NextResponse } from "next/server";
import { storage } from "@fletcher/api";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pdf: "application/pdf",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key } = await ctx.params;
  const storageKey = key.join("/");
  try {
    const data = await storage.read(storageKey);
    const ext = storageKey.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(data.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
