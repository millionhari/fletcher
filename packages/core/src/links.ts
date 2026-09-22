/**
 * Recognise where a pasted link points. Two jobs: pick an icon/label for a
 * reference link (task attachments), and decide whether a link is a cloud file
 * Fletcher can copy in (deliverable versions).
 */
export type LinkProvider = "google_drive" | "google_docs" | "dropbox" | "box" | "notion" | "figma" | "youtube" | "vimeo" | "frameio" | "airtable" | null;

export const LINK_PROVIDER_LABELS: Record<NonNullable<LinkProvider>, string> = {
  google_drive: "Google Drive",
  google_docs: "Google Doc",
  dropbox: "Dropbox",
  box: "Box",
  notion: "Notion",
  figma: "Figma",
  youtube: "YouTube",
  vimeo: "Vimeo",
  frameio: "Frame.io",
  airtable: "Airtable",
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function detectLinkProvider(url: string): LinkProvider {
  const host = hostOf(url);
  if (!host) return null;
  if (host === "drive.google.com") return "google_drive";
  if (host === "docs.google.com") return "google_docs";
  if (host === "dropbox.com" || host.endsWith(".dropbox.com")) return "dropbox";
  if (host === "box.com" || host.endsWith(".box.com")) return "box";
  if (host === "notion.so" || host.endsWith(".notion.so") || host === "notion.site" || host.endsWith(".notion.site")) return "notion";
  if (host === "figma.com") return "figma";
  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") return "youtube";
  if (host === "vimeo.com" || host === "player.vimeo.com") return "vimeo";
  if (host === "frame.io" || host.endsWith(".frame.io")) return "frameio";
  if (host === "airtable.com") return "airtable";
  return null;
}

export type CloudProvider = "google_drive" | "dropbox" | "box";
export interface ParsedCloudLink {
  provider: CloudProvider;
  /** Provider file id when the URL carries one (Drive, Box file URLs); null for opaque share links. */
  id: string | null;
  url: string;
}

/** A link to a *file* on a cloud drive that can be fetched and copied in. Folder and doc links return null. */
export function parseCloudLink(raw: string): ParsedCloudLink | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "drive.google.com") {
    const m = u.pathname.match(/^\/file\/d\/([\w-]+)/);
    const id = m?.[1] ?? (u.pathname.startsWith("/open") || u.pathname.startsWith("/uc") ? u.searchParams.get("id") : null);
    return id ? { provider: "google_drive", id, url: `https://drive.google.com/file/d/${id}/view` } : null;
  }
  if (host === "dropbox.com" || host.endsWith(".dropbox.com")) {
    // /s/<key>/<name>, /scl/fi/<id>/<name>?rlkey=…, /sh/… (folders — rejected)
    if (u.pathname.startsWith("/s/") || u.pathname.startsWith("/scl/fi/")) {
      u.searchParams.set("dl", "1");
      return { provider: "dropbox", id: null, url: u.toString() };
    }
    return null;
  }
  if (host === "box.com" || host.endsWith(".box.com")) {
    const file = u.pathname.match(/^\/file\/(\d+)/);
    if (file) return { provider: "box", id: file[1]!, url: u.toString() };
    if (u.pathname.startsWith("/s/")) return { provider: "box", id: null, url: u.toString() };
    return null;
  }
  return null;
}

/**
 * Hosts an import is allowed to fetch from, per provider. Every redirect hop
 * is checked against this so a share link can't be used to make the server
 * fetch something internal.
 */
export const ALLOWED_FETCH_HOSTS: Record<CloudProvider, string[]> = {
  google_drive: ["www.googleapis.com"],
  dropbox: ["www.dropbox.com", "dl.dropboxusercontent.com", "*.dl.dropboxusercontent.com", "dl.dropbox.com", "uc*.dl.dropboxusercontent.com"],
  box: ["api.box.com", "*.boxcloud.com", "dl.boxcloud.com"],
};

export function hostAllowed(provider: CloudProvider, host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_FETCH_HOSTS[provider].some((pattern) => {
    if (pattern.startsWith("*.")) return h.endsWith(pattern.slice(1));
    if (pattern.includes("*")) return new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]*") + "$").test(h);
    return h === pattern;
  });
}
