import { Readable } from "node:stream";
import { hostAllowed, type CloudProvider } from "@fletcher/core";
import type { Db } from "@fletcher/db";
import { getValidAccessToken } from "../../connections";

/** What an import needs from wherever the file lives. */
export interface ResolvedSource {
  name: string;
  mimeType: string;
  bytes: number | null;
  open(): Promise<Readable>;
}

export class SourceNotAccessibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceNotAccessibleError";
  }
}

export type ImportSource =
  | { kind: "google_drive"; fileId: string; name?: string; mimeType?: string; bytes?: number }
  | { kind: "box"; fileId: string; name?: string; mimeType?: string; bytes?: number }
  | { kind: "dropbox_chooser"; link: string; name: string; bytes?: number }
  | { kind: "share_link"; provider: CloudProvider; url: string; id: string | null };

const MAX_REDIRECTS = 5;

/**
 * fetch that walks redirects by hand so every hop stays on the provider's
 * hosts — the only defence that matters against a share link pointing the
 * server at something it shouldn't touch.
 */
async function guardedFetch(provider: CloudProvider, url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const host = new URL(current).hostname;
    if (!hostAllowed(provider, host)) throw new SourceNotAccessibleError(`Refusing to fetch from ${host}`);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new SourceNotAccessibleError("Redirect without a location");
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new SourceNotAccessibleError("Too many redirects");
}

function fromResponse(res: Response, fallbackName: string, fallbackType?: string): ResolvedSource {
  const type = res.headers.get("content-type")?.split(";")[0]?.trim() || fallbackType || "application/octet-stream";
  if (type === "text/html") throw new SourceNotAccessibleError("That link opens a web page, not a file. Set sharing to anyone with the link, or upload the file.");
  const len = res.headers.get("content-length");
  const disposition = res.headers.get("content-disposition") ?? "";
  const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return { name: nameMatch?.[1] ? decodeURIComponent(nameMatch[1]) : fallbackName, mimeType: type, bytes: len ? Number(len) : null, open: async () => Readable.fromWeb(res.body as never) };
}

const GOOGLE_DOC_EXPORT: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.spreadsheet": { mime: "application/pdf", ext: ".pdf" },
};

async function googleDrive(db: Db, userId: string | null, fileId: string, hint?: { name?: string; mimeType?: string; bytes?: number }): Promise<ResolvedSource> {
  // A picked file uses the person's token; a public link uses the API key.
  const auth: Record<string, string> = userId ? { authorization: `Bearer ${await getValidAccessToken(db, userId, "google_drive")}` } : {};
  const key = userId ? "" : `&key=${process.env.GOOGLE_API_KEY ?? ""}`;
  if (!userId && !process.env.GOOGLE_API_KEY) throw new SourceNotAccessibleError("Connect Google Drive to import from Drive links.");
  const metaRes = await guardedFetch("google_drive", `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,size,mimeType&supportsAllDrives=true${key}`, { headers: auth });
  if (metaRes.status === 403 || metaRes.status === 404) throw new SourceNotAccessibleError("Fletcher can't open this Drive file. Set sharing to anyone with the link, or upload the file.");
  if (!metaRes.ok) throw new SourceNotAccessibleError(`Google Drive returned ${metaRes.status}`);
  const meta = (await metaRes.json()) as { name?: string; size?: string; mimeType?: string };
  const exp = meta.mimeType ? GOOGLE_DOC_EXPORT[meta.mimeType] : undefined;
  if (meta.mimeType?.startsWith("application/vnd.google-apps.") && !exp) throw new SourceNotAccessibleError("That Google file type can't be exported. Download it and upload the file instead.");
  const url = exp
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exp.mime)}${key}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true${key}`;
  const name = (meta.name ?? hint?.name ?? "file") + (exp ? exp.ext : "");
  return {
    name,
    mimeType: exp?.mime ?? meta.mimeType ?? hint?.mimeType ?? "application/octet-stream",
    bytes: exp ? null : Number(meta.size ?? hint?.bytes ?? 0) || null,
    open: async () => {
      const res = await guardedFetch("google_drive", url, { headers: auth });
      if (!res.ok || !res.body) throw new SourceNotAccessibleError(`Google Drive download failed (${res.status})`);
      return Readable.fromWeb(res.body as never);
    },
  };
}

async function boxFile(db: Db, userId: string | null, fileId: string | null, shareUrl: string | null, hint?: { name?: string; mimeType?: string; bytes?: number }): Promise<ResolvedSource> {
  if (!userId) throw new SourceNotAccessibleError("Connect Box to import Box files and share links.");
  const token = await getValidAccessToken(db, userId, "box");
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  let id = fileId;
  if (!id && shareUrl) {
    const res = await guardedFetch("box", "https://api.box.com/2.0/shared_items?fields=id,name,size,type", { headers: { ...headers, boxapi: `shared_link=${shareUrl}` } });
    if (!res.ok) throw new SourceNotAccessibleError("Fletcher can't open this Box link. Check that the shared link is still active.");
    const j = (await res.json()) as { id?: string; type?: string };
    if (j.type !== "file" || !j.id) throw new SourceNotAccessibleError("That Box link is a folder, not a file.");
    id = j.id;
    headers.boxapi = `shared_link=${shareUrl}`;
  }
  const metaRes = await guardedFetch("box", `https://api.box.com/2.0/files/${id}?fields=name,size`, { headers });
  if (!metaRes.ok) throw new SourceNotAccessibleError(`Box returned ${metaRes.status}`);
  const meta = (await metaRes.json()) as { name?: string; size?: number };
  return {
    name: meta.name ?? hint?.name ?? "file",
    mimeType: hint?.mimeType ?? "application/octet-stream",
    bytes: meta.size ?? hint?.bytes ?? null,
    open: async () => {
      const res = await guardedFetch("box", `https://api.box.com/2.0/files/${id}/content`, { headers });
      if (!res.ok || !res.body) throw new SourceNotAccessibleError(`Box download failed (${res.status})`);
      return Readable.fromWeb(res.body as never);
    },
  };
}

async function dropboxLink(url: string, fallbackName: string): Promise<ResolvedSource> {
  const res = await guardedFetch("dropbox", url);
  if (res.status === 404 || res.status === 403) throw new SourceNotAccessibleError("Fletcher can't open this Dropbox link. Check that the link is still shared.");
  if (!res.ok || !res.body) throw new SourceNotAccessibleError(`Dropbox returned ${res.status}`);
  return fromResponse(res, fallbackName);
}

export async function resolveSource(db: Db, userId: string | null, source: ImportSource): Promise<ResolvedSource> {
  switch (source.kind) {
    case "google_drive":
      return googleDrive(db, userId, source.fileId, source);
    case "box":
      return boxFile(db, userId, source.fileId, null, source);
    case "dropbox_chooser":
      return dropboxLink(source.link, source.name);
    case "share_link":
      if (source.provider === "google_drive") return googleDrive(db, userId, source.id!, undefined);
      if (source.provider === "box") return boxFile(db, userId, source.id, source.id ? null : source.url);
      return dropboxLink(source.url, "file");
  }
}
