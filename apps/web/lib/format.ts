import { differenceInCalendarDays, format, parseISO } from "date-fns";

export function fmtDate(iso: string | null | undefined, style: "short" | "long" | "weekday" = "short"): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (style === "long") return format(d, "MMMM d, yyyy");
  if (style === "weekday") return format(d, "EEE, MMM d");
  return format(d, "MMM d");
}

export function fmtDateYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(parseISO(iso), "MMM d, yyyy");
}

/** "in 3d", "today", "2d ago", "in 6w" */
export function relativeDays(iso: string | null | undefined, today = new Date()): string {
  if (!iso) return "";
  const diff = differenceInCalendarDays(parseISO(iso), today);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  const abs = Math.abs(diff);
  const unit = abs >= 14 ? `${Math.round(abs / 7)}w` : `${abs}d`;
  return diff > 0 ? `in ${unit}` : `${unit} ago`;
}

/** Signed offset label relative to an anchor: "R−42d", "R+7d", "R". */
export function offsetLabel(iso: string | null | undefined, anchor: string, prefix = "R"): string {
  if (!iso) return "";
  const diff = differenceInCalendarDays(parseISO(iso), parseISO(anchor));
  if (diff === 0) return prefix;
  return diff > 0 ? `${prefix}+${diff}d` : `${prefix}−${Math.abs(diff)}d`;
}

export function fmtTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined) return hhmm;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

export { fmtBytes } from "@fletcher/core";

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function pct(done: number, total: number): number {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}
