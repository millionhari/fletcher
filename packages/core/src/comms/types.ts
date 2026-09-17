import type { Platform } from "../enums";
import type { ISODate } from "../dates";

export interface CommsItemDef {
  platform: Platform;
  title: string;
  children?: CommsItemDef[];
}

export interface CommsMomentDef {
  key: string;
  title: string;
  offsetDays: number;
  /** Local time in HH:mm (24h). */
  time?: string;
  cta?: string;
  assetHint?: string;
  items: CommsItemDef[];
}

export interface CommsChecklistDef {
  key: string;
  title: string;
  description?: string;
  items: CommsItemDef[];
}

export interface CommsTemplateDef {
  /** Standing checklists that are not tied to a date (e.g. fan-info export sources). */
  checklists?: CommsChecklistDef[];
  moments: CommsMomentDef[];
}

export interface GeneratedMomentItem {
  platform: Platform;
  title: string;
  children: GeneratedMomentItem[];
}

export interface GeneratedMoment {
  key: string;
  title: string;
  scheduledDate: ISODate;
  scheduledTime: string | null;
  cta: string | null;
  assetHint: string | null;
  sortOrder: number;
  items: GeneratedMomentItem[];
}
