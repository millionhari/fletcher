import type { VersionSource } from "./enums";

export interface ParsedVideoLink {
  source: VersionSource;
  url: string;
  externalId: string | null;
}

/** Detect YouTube / Vimeo links and normalize them; anything else is a plain URL. */
export function parseVideoLink(raw: string): ParsedVideoLink {
  const url = raw.trim();
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt?.[1]) return { source: "youtube", url, externalId: yt[1] };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo?.[1]) return { source: "vimeo", url, externalId: vimeo[1] };
  return { source: "url", url, externalId: null };
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  return `${m}:${String(rem).padStart(2, "0")}`;
}
