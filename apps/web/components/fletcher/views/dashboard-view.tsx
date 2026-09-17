"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarClock, Megaphone, Plus } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { fmtDate, fmtTime, pct, relativeDays } from "@/lib/format";
import { PROJECT_TYPE_LABELS } from "@fletcher/core";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionHeader } from "@/components/fletcher/page-header";
import { TaskStatusBadge } from "@/components/fletcher/status-badge";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { ProgressRing } from "@/components/fletcher/progress-ring";
import { EmptyState } from "@/components/fletcher/empty-state";
import { ActivityFeed } from "@/components/fletcher/activity-feed";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.dashboard.overview.queryOptions({ workspace: ws.slug, horizonDays: 30 }));
  const base = `/w/${ws.slug}`;

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title={<Skeleton className="h-7 w-48" />} />
        <div className="grid grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const groupedUpcoming = groupByDate(data.upcoming);

  return (
    <div className="stagger">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title={`${ws.artistName} · Overview`}
        description="Every deadline, rollout moment and review across the campaign, in one place."
        actions={
          <Button asChild size="sm">
            <Link href={`${base}/projects/new`}><Plus />New project</Link>
          </Button>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {data.projects.map((p) => (
          <Link key={p.id} href={`${base}/projects/${p.id}`} className="surface group flex flex-col gap-3 p-4 transition-shadow hover:shadow-float">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-[3px]" style={{ background: p.color }} />
                  <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">{PROJECT_TYPE_LABELS[p.type]}</span>
                </div>
                <div className="mt-1 truncate text-sm font-semibold">{p.name}</div>
              </div>
              <ProgressRing value={pct(p.doneCount, p.taskCount)} size={28} />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xs text-muted-foreground">{p.anchorLabel}</div>
                <div className="tabular text-sm font-medium">{fmtDate(p.anchorDate, "weekday")}</div>
              </div>
              <div className="text-right text-2xs text-muted-foreground">
                <span className="tabular font-medium text-foreground">{relativeDays(p.anchorDate)}</span>
                <div>{p.doneCount}/{p.taskCount} done</div>
              </div>
            </div>
          </Link>
        ))}
        {data.projects.length === 0 && (
          <EmptyState className="md:col-span-3" title="No projects yet" description="Create a single, album, music video or tour and Fletcher will generate the timeline." action={<Button asChild size="sm"><Link href={`${base}/projects/new`}>New project</Link></Button>} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {data.overdue.length > 0 && (
            <section>
              <SectionHeader title={<span className="flex items-center gap-1.5 text-danger"><AlertTriangle className="size-3.5" />Overdue</span>} count={data.overdue.length} />
              <div className="surface divide-y divide-border">
                {data.overdue.map((t) => <TaskLine key={t.id} task={t} base={base} overdue />)}
              </div>
            </section>
          )}

          <section>
            <SectionHeader title={<span className="flex items-center gap-1.5"><CalendarClock className="size-3.5" />Next 30 days</span>} count={data.upcoming.length} actions={<Button asChild variant="ghost" size="xs"><Link href={`${base}/calendar`}>Calendar <ArrowRight /></Link></Button>} />
            {groupedUpcoming.length === 0 ? (
              <EmptyState title="Nothing due in the next 30 days" description="Quiet stretch. Check the calendar for what's further out." />
            ) : (
              <div className="space-y-4">
                {groupedUpcoming.map(([date, tasks]) => (
                  <div key={date}>
                    <div className="mb-1.5 flex items-baseline gap-2 px-1">
                      <span className="text-xs font-semibold">{fmtDate(date, "weekday")}</span>
                      <span className="text-2xs text-muted-foreground">{relativeDays(date)}</span>
                    </div>
                    <div className="surface divide-y divide-border">
                      {tasks.map((t) => <TaskLine key={t.id} task={t} base={base} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <SectionHeader title={<span className="flex items-center gap-1.5"><Megaphone className="size-3.5" />Rollout moments</span>} count={data.moments.length} />
            {data.moments.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">No comms moments scheduled in the next 30 days.</p>
            ) : (
              <div className="surface divide-y divide-border">
                {data.moments.slice(0, 8).map((m) => (
                  <Link key={m.id} href={`${base}/projects/${m.projectId}/comms#${m.id}`} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/60">
                    <div className="w-12 shrink-0">
                      <div className="tabular text-xs font-semibold">{fmtDate(m.scheduledDate)}</div>
                      <div className="text-2xs text-muted-foreground">{fmtTime(m.scheduledTime)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{m.title}</div>
                      <div className="flex items-center gap-1 truncate text-2xs text-muted-foreground"><span className="size-1.5 rounded-full" style={{ background: m.projectColor }} />{m.projectName}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section>
            <SectionHeader title="Activity" />
            <ActivityFeed entries={data.activity} />
          </section>
        </div>
      </div>
    </div>
  );
}

type TaskRow = { id: string; title: string; dueDate: string | null; status: "todo" | "in_progress" | "in_review" | "blocked" | "done"; projectId: string; projectName: string; projectColor: string; assigneeName: string | null; phase: string };

function TaskLine({ task, base, overdue }: { task: TaskRow; base: string; overdue?: boolean }) {
  return (
    <Link href={`${base}/projects/${task.projectId}/timeline#${task.id}`} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/60">
      <span className="size-2 shrink-0 rounded-[3px]" style={{ background: task.projectColor }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{task.title}</div>
        <div className="truncate text-2xs text-muted-foreground">{task.projectName} · {task.phase}</div>
      </div>
      <TaskStatusBadge status={task.status} />
      <span className={cn("tabular w-16 shrink-0 text-right text-xs", overdue ? "font-medium text-danger" : "text-muted-foreground")}>{overdue ? relativeDays(task.dueDate) : fmtDate(task.dueDate)}</span>
      <MemberAvatar name={task.assigneeName} size="xs" />
    </Link>
  );
}

function groupByDate<T extends { dueDate: string | null }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = r.dueDate ?? "";
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()];
}
