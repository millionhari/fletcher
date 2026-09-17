import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";

/** All dates in Fletcher are date-only ISO strings (YYYY-MM-DD). */
export type ISODate = string;

export function toISODate(d: Date): ISODate {
  return format(d, "yyyy-MM-dd");
}
export function fromISODate(s: ISODate): Date {
  return parseISO(s);
}
export function addDaysISO(s: ISODate, days: number): ISODate {
  return toISODate(addDays(fromISODate(s), days));
}
export function diffDaysISO(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(fromISODate(a), fromISODate(b));
}
export function todayISO(): ISODate {
  return toISODate(new Date());
}

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const WEEKDAY_INDEX: Record<Weekday, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** Move a date to the given weekday, either backward or forward, staying put if it already matches. */
export function snapToWeekday(s: ISODate, weekday: Weekday, direction: "back" | "forward"): ISODate {
  const d = fromISODate(s);
  const current = getDay(d);
  const target = WEEKDAY_INDEX[weekday];
  if (current === target) return s;
  const delta = direction === "back" ? -((current - target + 7) % 7) : (target - current + 7) % 7;
  return toISODate(addDays(d, delta));
}
