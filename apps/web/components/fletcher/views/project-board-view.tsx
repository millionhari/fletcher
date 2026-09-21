"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Film, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDate, relativeDays } from "@/lib/format";
import { TASK_STATUSES, TASK_STATUS_LABELS, todayISO, type TaskStatus } from "@fletcher/core";
import { useProjectData, useInvalidateProject } from "@/lib/hooks/use-project-data";
import { useTaskParam } from "@/lib/hooks/use-task-param";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSelect, AssigneePicker } from "@/components/fletcher/task-controls";
import { RolePill } from "@/components/fletcher/role-pill";

const COLUMN_TONE: Record<TaskStatus, string> = { todo: "bg-foreground/30", in_progress: "bg-info", in_review: "bg-brand", blocked: "bg-danger", done: "bg-success" };

export function ProjectBoardView() {
  const { data, isLoading, ws, projectId, trpc } = useProjectData();
  const qc = useQueryClient();
  const invalidate = useInvalidateProject();
  const today = todayISO();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const { setTaskId } = useTaskParam();

  const queryKey = trpc.projects.get.queryKey({ workspace: ws.slug, projectId });
  const move = useMutation(
    trpc.tasks.update.mutationOptions({
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey });
        const previous = qc.getQueryData(queryKey);
        qc.setQueryData(queryKey, (old: typeof data) =>
          old ? { ...old, tasks: old.tasks.map((t) => (t.id === input.taskId ? { ...t, status: input.status ?? t.status } : t)) } : old,
        );
        return { previous };
      },
      onError: (e, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
        toast.error(e.message);
      },
      onSettled: () => invalidate(),
    }),
  );

  const columns = useMemo(() => {
    if (!data) return [];
    return TASK_STATUSES.map((status) => ({ status, tasks: data.tasks.filter((t) => t.status === status).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")) }));
  }, [data]);
  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;

  const drop = (status: TaskStatus) => {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id) return;
    const task = data.tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    move.mutate({ workspace: ws.slug, taskId: id, status });
  };

  return (
    <div className="fade-in-up scrollbar-thin ml-[calc(50%-50cqw)] w-[100cqw] overflow-x-auto px-8 pb-4">
      <div className="flex min-w-max justify-center gap-3">
        {columns.map((col) => (
          <div
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col.status) setOver(col.status); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === col.status ? null : o)); }}
            onDrop={(e) => { e.preventDefault(); drop(col.status); }}
            className={cn("flex min-w-[320px] max-w-[340px] flex-1 flex-col rounded-xl bg-muted/60 p-2 transition-colors", over === col.status && dragging && "bg-brand-soft ring-2 ring-brand/40")}
          >
            <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
              <span className={cn("size-2 rounded-full", COLUMN_TONE[col.status])} />
              <span className="text-xs font-semibold">{TASK_STATUS_LABELS[col.status]}</span>
              <span className="tabular text-2xs text-muted-foreground">{col.tasks.length}</span>
            </div>
            <div className="flex min-h-[80px] flex-1 flex-col gap-2">
              {col.tasks.map((t) => {
                const overdue = !!t.dueDate && t.dueDate < today && t.status !== "done";
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); setDragging(t.id); }}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    onClick={() => setTaskId(t.id)}
                    className={cn("surface group flex cursor-pointer flex-col gap-2 p-2.5 transition-shadow hover:shadow-float active:cursor-grabbing", dragging === t.id && "opacity-40")}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground" />
                      <span className="min-w-0 flex-1 text-[13px] font-medium leading-4">{t.title}</span>
                      {t.deliverableId && <Link href={`/w/${ws.slug}/deliverables/${t.deliverableId}`} onClick={(e) => e.stopPropagation()} className="text-brand" aria-label="Open review" draggable={false}><Film className="size-3.5" /></Link>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <StatusSelect taskId={t.id} status={t.status} />
                        <RolePill role={t.roleKey} />
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        <span className={cn("tabular whitespace-nowrap text-2xs", overdue ? "font-medium text-danger" : "text-muted-foreground")}>{t.dueDate ? `${fmtDate(t.dueDate)} · ${relativeDays(t.dueDate)}` : "no date"}</span>
                        <AssigneePicker taskId={t.id} assigneeMemberId={t.assigneeMemberId} assigneeName={t.assigneeName} roleKey={t.roleKey} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {col.tasks.length === 0 && <div className={cn("rounded-lg border border-dashed border-border py-6 text-center text-2xs text-muted-foreground", over === col.status && dragging && "border-brand text-brand")}>{dragging ? "Drop here" : "Empty"}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
