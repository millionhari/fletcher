"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, relativeDays } from "@/lib/format";
import { TASK_STATUSES, TASK_STATUS_LABELS, todayISO, type TaskStatus } from "@fletcher/core";
import { useProjectData } from "@/lib/hooks/use-project-data";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSelect, AssigneePicker } from "@/components/fletcher/task-controls";
import { RolePill } from "@/components/fletcher/role-pill";

const COLUMN_TONE: Record<TaskStatus, string> = { todo: "bg-foreground/30", in_progress: "bg-info", in_review: "bg-brand", blocked: "bg-danger", done: "bg-success" };

export function ProjectBoardView() {
  const { data, isLoading, ws } = useProjectData();
  const today = todayISO();
  const columns = useMemo(() => {
    if (!data) return [];
    return TASK_STATUSES.map((status) => ({ status, tasks: data.tasks.filter((t) => t.status === status).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")) }));
  }, [data]);
  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="fade-in-up scrollbar-thin -mx-8 overflow-x-auto px-8 pb-4">
      <div className="flex min-w-max gap-3">
        {columns.map((col) => (
          <div key={col.status} className="flex w-[272px] shrink-0 flex-col rounded-xl bg-muted/60 p-2">
            <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
              <span className={cn("size-2 rounded-full", COLUMN_TONE[col.status])} />
              <span className="text-xs font-semibold">{TASK_STATUS_LABELS[col.status]}</span>
              <span className="tabular text-2xs text-muted-foreground">{col.tasks.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {col.tasks.map((t) => {
                const overdue = !!t.dueDate && t.dueDate < today && t.status !== "done";
                return (
                  <div key={t.id} className="surface group flex flex-col gap-2 p-2.5 transition-shadow hover:shadow-float">
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 text-[13px] font-medium leading-4">{t.title}</span>
                      {t.deliverableId && <Link href={`/w/${ws.slug}/deliverables/${t.deliverableId}`} className="text-brand" aria-label="Open review"><Film className="size-3.5" /></Link>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <StatusSelect taskId={t.id} status={t.status} />
                        <RolePill role={t.roleKey} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("tabular text-2xs", overdue ? "font-medium text-danger" : "text-muted-foreground")}>{t.dueDate ? `${fmtDate(t.dueDate)} · ${relativeDays(t.dueDate)}` : "no date"}</span>
                        <AssigneePicker taskId={t.id} assigneeMemberId={t.assigneeMemberId} assigneeName={t.assigneeName} roleKey={t.roleKey} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {col.tasks.length === 0 && <div className="rounded-lg border border-dashed border-border py-6 text-center text-2xs text-muted-foreground">Empty</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
