export const PLANS = ["free", "paid", "custom"] as const;
export type Plan = (typeof PLANS)[number];

const GiB = 1024 ** 3;

/** Storage per plan. Custom is set per workspace; billing decides who is on what later. */
export const PLAN_QUOTA_BYTES: Record<Exclude<Plan, "custom">, number> = { free: 2 * GiB, paid: 100 * GiB };
export const PLAN_LABELS: Record<Plan, string> = { free: "Free", paid: "Pro", custom: "Custom" };

export function quotaBytesFor(plan: string, customQuotaGb: number | null | undefined): number {
  if (plan === "custom" && customQuotaGb && customQuotaGb > 0) return customQuotaGb * GiB;
  if (plan === "paid") return PLAN_QUOTA_BYTES.paid;
  return PLAN_QUOTA_BYTES.free;
}

/** Free workspaces link video (YouTube / Vimeo) rather than hosting it. */
export function videoUploadsAllowed(plan: string): boolean {
  return plan !== "free";
}

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|wmv|mpg|mpeg)$/i;

/** Browsers send an empty type for some .mov files, so the extension is checked too. */
export function isVideoFile(mimeType: string | null | undefined, fileName: string | null | undefined): boolean {
  if (mimeType?.startsWith("video/")) return true;
  return !!fileName && VIDEO_EXT.test(fileName);
}

export type UploadCheck =
  | { ok: true }
  | { ok: false; reason: "video_not_on_free" | "over_quota"; message: string };

/** Human byte sizes; used for quota copy and file lists alike. */
export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < GiB) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / GiB).toFixed(bytes < 10 * GiB ? 1 : 0)} GB`;
}

/**
 * The one place upload rules live. Called before a browser upload is reserved
 * and again when an import learns the real size, so the two paths cannot
 * drift apart.
 */
export function checkUploadAllowed(input: { plan: string; usedBytes: number; quotaBytes: number; incomingBytes: number; mimeType?: string | null; fileName?: string | null }): UploadCheck {
  if (!videoUploadsAllowed(input.plan) && isVideoFile(input.mimeType, input.fileName)) {
    return { ok: false, reason: "video_not_on_free", message: "Video uploads need a paid plan. Paste a YouTube or Vimeo link instead, or upgrade." };
  }
  if (input.usedBytes + input.incomingBytes > input.quotaBytes) {
    return { ok: false, reason: "over_quota", message: `This workspace is using ${fmtBytes(input.usedBytes)} of ${fmtBytes(input.quotaBytes)}. Free up space in Files, or upgrade.` };
  }
  return { ok: true };
}
