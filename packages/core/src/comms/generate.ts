import { addDaysISO, type ISODate } from "../dates";
import type { CommsItemDef, CommsTemplateDef, GeneratedMoment, GeneratedMomentItem } from "./types";

function toItems(items: CommsItemDef[]): GeneratedMomentItem[] {
  return items.map((i) => ({ platform: i.platform, title: i.title, children: toItems(i.children ?? []) }));
}

export function generateCommsMoments(def: CommsTemplateDef, anchor: ISODate): GeneratedMoment[] {
  const moments = def.moments.map((m) => ({
    key: m.key,
    title: m.title,
    scheduledDate: addDaysISO(anchor, m.offsetDays),
    scheduledTime: m.time ?? null,
    cta: m.cta ?? null,
    assetHint: m.assetHint ?? null,
    sortOrder: 0,
    items: toItems(m.items),
  }));
  moments.sort((a, b) => {
    const d = a.scheduledDate.localeCompare(b.scheduledDate);
    if (d !== 0) return d;
    return (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "");
  });
  return moments.map((m, i) => ({ ...m, sortOrder: i }));
}

export function countItems(items: GeneratedMomentItem[]): number {
  return items.reduce((n, i) => n + 1 + countItems(i.children), 0);
}
