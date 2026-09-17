"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Film, Link2, MoreHorizontal, Pin, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDate, offsetLabel, relativeDays } from "@/lib/format";
import { todayISO } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusSelect, AssigneePicker, DatePill } from "@/components/fletcher/task-controls";
import { TaskStatusBadge } from "@/components/fletcher/status-badge";
import { RolePill } from "@/components/fletcher/role-pill";
import { ActivityFeed } from "@/components/fletcher/activity-feed";
import { CommentThread } from "@/components/fletcher/comment-thread";
import { TaskDocEditor } from "@/components/fletcher/task/task-doc-editor";
import { TaskChecklist } from "@/components/fletcher/task/task-checklist";
import { TaskAttachments } from "@/components/fletcher/task/task-attachments";

export interface TaskPanelProps {
  taskId: string;
  mode: "sheet" | "page";
  onClose?: () => void;
  onNavigate?: (taskId: string) => void;
}

/** The task detail: header, doc, checklist, attachments, properties, comments, activity. */
export function TaskPanel({ taskId, mode, onClose, onNavigate }: TaskPanelProps) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(trpc.taskDetail.get.queryOptions({ workspace: ws.slug, taskId }));
  const comments = useQuery(trpc.comments.listByTask.queryOptions({ workspace: ws.slug, taskId }));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const today = todayISO();

  const invalidate = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: trpc.taskDetail.get.queryKey({ workspace: ws.slug, taskId }) }),
      qc.invalidateQueries({ queryKey: trpc.projects.get.queryKey() }),
      qc.invalidateQueries({ queryKey: trpc.dashboard.overview.queryKey() }),
    ]);
  }, [qc, trpc, ws.slug, taskId]);

  const saveDoc = useMutation(trpc.taskDetail.saveDoc.mutationOptions({ onSuccess: (r) => setSavedAt(new Date(r.savedAt)), onError: (e) => toast.error(e.message) }));
  const rename = useMutation(trpc.taskDetail.rename.mutationOptions({ onSuccess: invalidate, onError: (e) => toast.error(e.message) }));
  const update = useMutation(trpc.tasks.update.mutationOptions({ onSuccess: invalidate, onError: (e) => toast.error(e.message) }));
  const del = useMutation(trpc.tasks.delete.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("Task deleted"); onClose?.(); }, onError: (e) => toast.error(e.message) }));
  const createChild = useMutation(trpc.tasks.createProjectFromMilestone.mutationOptions({ onSuccess: async (p) => { await invalidate(); toast.success(`${p.name} created`); }, onError: (e) => toast.error(e.message) }));

  const onSave = useCallback((s: { doc: unknown; docText: string }) => saveDoc.mutate({ workspace: ws.slug, taskId, doc: s.doc, docText: s.docText }), [saveDoc, ws.slug, taskId]);

  useEffect(() => {
    if (!q.data) return;
    setSavedAt(q.data.task.docUpdatedAt ? new Date(q.data.task.docUpdatedAt) : null);
  }, [q.data?.task.id, q.data?.task.docUpdatedAt]);

  useEffect(() => {
    if (mode !== "sheet") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "[" && q.data?.prevTaskId) onNavigate?.(q.data.prevTaskId);
      if (e.key === "]" && q.data?.nextTaskId) onNavigate?.(q.data.nextTaskId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, q.data?.prevTaskId, q.data?.nextTaskId, onNavigate]);

  if (q.isLoading || !q.data) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-4 w-40" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-40 w-full rounded-lg" /><Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }
  const { task, project, phaseTitle, assignee, dependencies, dependents, checklist, attachments, activity, prevTaskId, nextTaskId } = q.data;
  const overdue = !!task.dueDate && task.dueDate < today && task.status !== "done";
  const milestone = task.milestone as { projectType: string; label: string } | null;
  const base = `/w/${ws.slug}/projects/${project.id}`;
  const commitTitle = () => { const t = titleDraft.trim(); setEditingTitle(false); if (t && t !== task.title) rename.mutate({ workspace: ws.slug, taskId, title: t }); };

  return (
    <div className={cn("flex min-h-full flex-col", mode === "page" && "fade-in-up")}>
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
        {mode === "sheet" ? (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><X /></Button>
            <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><span className="size-2 rounded-[3px]" style={{ background: project.color }} />{project.name}<span>·</span>{phaseTitle}</span>
            <div className="ml-auto flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Previous task" disabled={!prevTaskId} onClick={() => prevTaskId && onNavigate?.(prevTaskId)}><ChevronLeft /></Button></TooltipTrigger><TooltipContent>Previous ([)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Next task" disabled={!nextTaskId} onClick={() => nextTaskId && onNavigate?.(nextTaskId)}><ChevronRight /></Button></TooltipTrigger><TooltipContent>Next (])</TooltipContent></Tooltip>
              <Button asChild variant="outline" size="sm"><Link href={`${base}/tasks/${task.id}`}><ExternalLink />Open full page</Link></Button>
              <TaskMenu onDelete={() => { if (confirm(`Delete "${task.title}"?`)) del.mutate({ workspace: ws.slug, taskId }); }} milestone={milestone} childProjectId={task.childProjectId} onCreateChild={() => createChild.mutate({ workspace: ws.slug, taskId })} wsSlug={ws.slug} />
            </div>
          </>
        ) : (
          <>
            <Button asChild variant="ghost" size="sm"><Link href={`${base}/timeline`}><ArrowLeft />Timeline</Link></Button>
            <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><span className="size-2 rounded-[3px]" style={{ background: project.color }} /><Link href={base} className="hover:text-foreground">{project.name}</Link><span>·</span>{phaseTitle}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button asChild variant="outline" size="sm"><Link href={`${base}/timeline?task=${task.id}`}>Open as panel</Link></Button>
              <TaskMenu onDelete={() => { if (confirm(`Delete "${task.title}"?`)) del.mutate({ workspace: ws.slug, taskId }); }} milestone={milestone} childProjectId={task.childProjectId} onCreateChild={() => createChild.mutate({ workspace: ws.slug, taskId })} wsSlug={ws.slug} />
            </div>
          </>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-7 px-6 py-5">
          <div>
            {editingTitle ? (
              <Input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={commitTitle} onKeyDown={(e) => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") setEditingTitle(false); }} className="h-9 text-xl font-semibold" />
            ) : (
              <h1 onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }} className={cn("cursor-text rounded-md px-1 -mx-1 text-xl font-semibold leading-7 hover:bg-muted/60", task.status === "done" && "text-muted-foreground line-through")} title="Click to rename">{task.title}</h1>
            )}
            {(task.deliverableId || milestone) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {task.deliverableId && <Link href={`/w/${ws.slug}/deliverables/${task.deliverableId}`} className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-soft px-2 text-xs font-medium text-brand hover:underline"><Film className="size-3.5" />Open review</Link>}
              {milestone && !task.childProjectId && <button onClick={() => createChild.mutate({ workspace: ws.slug, taskId })} className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-border px-2 text-xs font-medium text-muted-foreground hover:border-brand hover:text-brand"><Sparkles className="size-3.5" />Create {milestone.label} project</button>}
              {milestone && task.childProjectId && <Link href={`/w/${ws.slug}/projects/${task.childProjectId}`} className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs font-medium hover:underline">Open {milestone.label}</Link>}
            </div>
            )}
          </div>

          <TaskDocEditor key={task.id} initialDoc={task.doc} seedText={task.description} onSave={onSave} saving={saveDoc.isPending} savedAt={savedAt} />

          <TaskChecklist taskId={task.id} items={checklist} taskStatus={task.status} onChanged={invalidate} onMarkTaskDone={() => update.mutate({ workspace: ws.slug, taskId, status: "done" })} />

          <TaskAttachments taskId={task.id} projectId={project.id} attachments={attachments} onChanged={invalidate} />

          <div className="xl:hidden">
            <CommentThread target={{ taskId: task.id }} comments={comments.data ?? []} invalidate={invalidate} timeCoded={false} className="max-h-[520px]" />
          </div>
        </div>

        {/* Side column */}
        <aside className="space-y-6 border-t border-border bg-muted/30 px-5 py-5 xl:border-l xl:border-t-0">
          <section>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Properties</div>
            <dl className="space-y-1.5 text-xs">
              <Prop label="Status"><StatusSelect taskId={task.id} status={task.status} size="md" /></Prop>
              <Prop label="Due">
                <span className="inline-flex items-center gap-1.5">
                  <DatePill taskId={task.id} dueDate={task.dueDate} isOverridden={task.isDateOverridden} overdue={overdue} className="-ml-1.5" />
                  <span className="text-2xs text-muted-foreground">{task.dueDate ? relativeDays(task.dueDate) : ""}</span>
                </span>
              </Prop>
              <Prop label="Offset"><span className="font-mono">{offsetLabel(task.dueDate, project.anchorDate)}</span> <span className="text-muted-foreground">from {project.anchorLabel.toLowerCase()}</span>{task.isDateOverridden && <Tooltip><TooltipTrigger><Pin className="ml-1 inline size-3 text-warning" /></TooltipTrigger><TooltipContent>Pinned: won&apos;t move with the {project.anchorLabel.toLowerCase()}</TooltipContent></Tooltip>}</Prop>
              <Prop label="Start"><span className="tabular">{fmtDate(task.startDate)}</span></Prop>
              <Prop label="Owner"><span className="-ml-0.5 inline-flex"><AssigneePicker taskId={task.id} assigneeMemberId={task.assigneeMemberId} assigneeName={assignee?.name ?? null} roleKey={task.roleKey} compact={false} /></span></Prop>
              <Prop label="Role"><RolePill role={task.roleKey} /></Prop>
              <Prop label="Project"><Link href={base} className="hover:underline">{project.name}</Link></Prop>
              <Prop label="Phase">{phaseTitle}</Prop>
            </dl>
          </section>

          {(dependencies.length > 0 || dependents.length > 0) && (
            <section>
              <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Dependencies</div>
              {dependencies.length > 0 && (
                <div className="mb-2">
                  <div className="mb-1 text-2xs text-muted-foreground">Waits on</div>
                  <div className="flex flex-col gap-1">{dependencies.map((d) => <DepChip key={d.id} t={d} onClick={() => onNavigate?.(d.id)} />)}</div>
                </div>
              )}
              {dependents.length > 0 && (
                <div>
                  <div className="mb-1 text-2xs text-muted-foreground">Blocks</div>
                  <div className="flex flex-col gap-1">{dependents.map((d) => <DepChip key={d.id} t={d} onClick={() => onNavigate?.(d.id)} />)}</div>
                </div>
              )}
            </section>
          )}

          <section className="hidden xl:block">
            <CommentThread target={{ taskId: task.id }} comments={comments.data ?? []} invalidate={invalidate} timeCoded={false} className="max-h-[460px]" />
          </section>

          <section>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</div>
            <ActivityFeed entries={activity} compact />
          </section>
        </aside>
      </div>
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-6 items-center gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center overflow-visible">{children}</dd>
    </div>
  );
}

function DepChip({ t, onClick }: { t: { id: string; title: string; status: "todo" | "in_progress" | "in_review" | "blocked" | "done"; dueDate: string | null }; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-left text-xs hover:bg-muted">
      <Link2 className="size-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{t.title}</span>
      <TaskStatusBadge status={t.status} />
      <span className="tabular text-2xs text-muted-foreground">{fmtDate(t.dueDate)}</span>
    </button>
  );
}

function TaskMenu({ onDelete, milestone, childProjectId, onCreateChild, wsSlug }: { onDelete: () => void; milestone: { label: string } | null; childProjectId: string | null; onCreateChild: () => void; wsSlug: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {milestone && !childProjectId && <DropdownMenuItem onClick={onCreateChild}><Sparkles />Create {milestone.label} project</DropdownMenuItem>}
        {milestone && childProjectId && <DropdownMenuItem asChild><Link href={`/w/${wsSlug}/projects/${childProjectId}`}>Open {milestone.label}</Link></DropdownMenuItem>}
        {milestone && <DropdownMenuSeparator />}
        <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 />Delete task</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
