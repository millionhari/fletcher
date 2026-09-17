"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/format";
import { toISODate, todayISO } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/fletcher/page-header";

export function CalendarView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const gridStart = startOfWeek(month, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const from = toISODate(gridStart);
  const to = toISODate(new Date(gridEnd.getTime() + 86400000));
  const q = useQuery(trpc.dashboard.calendar.queryOptions({ workspace: ws.slug, from, to }));
  const today = todayISO();
  const base = `/w/${ws.slug}`;

  const byDay = useMemo(() => {
    const map = new Map<string, { tasks: NonNullable<typeof q.data>["tasks"]; moments: NonNullable<typeof q.data>["moments"]; anchors: NonNullable<typeof q.data>["projects"] }>();
    const get = (k: string) => { let v = map.get(k); if (!v) { v = { tasks: [], moments: [], anchors: [] }; map.set(k, v); } return v; };
    for (const t of q.data?.tasks ?? []) if (t.dueDate) get(t.dueDate).tasks.push(t);
    for (const m of q.data?.moments ?? []) if (m.scheduledDate) get(m.scheduledDate).moments.push(m);
    for (const p of q.data?.projects ?? []) if (p.anchorDate >= from && p.anchorDate < to) get(p.anchorDate).anchors.push(p);
    return map;
  }, [q.data, from, to]);

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Calendar"
        description="Task deadlines, rollout moments and release dates across every project."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month"><ChevronLeft /></Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
            <Button variant="outline" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight /></Button>
            <span className="ml-3 w-36 text-sm font-semibold">{format(month, "MMMM yyyy")}</span>
          </div>
        }
      />
      {q.data && q.data.projects.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3 text-2xs text-muted-foreground">
          {q.data.projects.map((p) => <span key={p.id} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[3px]" style={{ background: p.color }} />{p.name}</span>)}
          <span className="inline-flex items-center gap-1.5"><Megaphone className="size-3" />Rollout moment</span>
        </div>
      )}
      {q.isLoading ? (
        <Skeleton className="h-[640px] rounded-xl" />
      ) : (
        <div className="surface overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const iso = toISODate(d);
              const cell = byDay.get(iso);
              const inMonth = isSameMonth(d, month);
              const isToday = iso === today;
              return (
                <div key={iso} className={cn("min-h-[108px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30")}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn("tabular inline-flex size-5 items-center justify-center rounded-full text-2xs", isToday ? "bg-foreground font-semibold text-background" : inMonth ? "text-foreground" : "text-muted-foreground")}>{format(d, "d")}</span>
                  </div>
                  <div className="space-y-0.5">
                    {cell?.anchors.map((p) => (
                      <Link key={p.id} href={`${base}/projects/${p.id}`} className="block truncate rounded px-1 py-px text-2xs font-semibold text-white" style={{ background: p.color }}>★ {p.anchorLabel}: {p.name}</Link>
                    ))}
                    {cell?.moments.map((m) => (
                      <Link key={m.id} href={`${base}/projects/${m.projectId}/comms#${m.id}`} className="flex items-center gap-1 truncate rounded bg-muted px-1 py-px text-2xs hover:bg-accent"><Megaphone className="size-2.5 shrink-0" style={{ color: m.projectColor }} /><span className="truncate">{fmtTime(m.scheduledTime)} {m.title}</span></Link>
                    ))}
                    {cell?.tasks.slice(0, 4).map((t) => (
                      <Tooltip key={t.id}>
                        <TooltipTrigger asChild>
                          <Link href={`${base}/projects/${t.projectId}/timeline#${t.id}`} className={cn("flex items-center gap-1 truncate rounded px-1 py-px text-2xs hover:bg-accent", t.status === "done" && "text-muted-foreground line-through")}><span className="size-1.5 shrink-0 rounded-full" style={{ background: t.projectColor }} /><span className="truncate">{t.title}</span></Link>
                        </TooltipTrigger>
                        <TooltipContent>{t.projectName} · {t.title}</TooltipContent>
                      </Tooltip>
                    ))}
                    {cell && cell.tasks.length > 4 && <div className="px-1 text-2xs text-muted-foreground">+{cell.tasks.length - 4} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
