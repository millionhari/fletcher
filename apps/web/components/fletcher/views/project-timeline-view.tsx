"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Film, GanttChart, List, ListChecks, MessageSquare, Paperclip, Plus, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDate, offsetLabel } from "@/lib/format";
import { addDaysISO, diffDaysISO, MEMBER_ROLES, MEMBER_ROLE_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, todayISO, type MemberRole, type TaskStatus } from "@fletcher/core";
import { useProjectData, useInvalidateProject, useMembers } from "@/lib/hooks/use-project-data";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusSelect, AssigneePicker, DatePill } from "@/components/fletcher/task-controls";
import { RolePill } from "@/components/fletcher/role-pill";
import { EmptyState } from "@/components/fletcher/empty-state";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { FilterChip, chipClass } from "@/components/fletcher/filter-chip";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTaskParam } from "@/lib/hooks/use-task-param";

type Task = NonNullable<ReturnType<typeof useProjectData>["data"]>["tasks"][number];

// Same shape as the Overview work list's person filter, so the two read alike.
type PersonFilter = { kind: "everyone" } | { kind: "mine" } | { kind: "member"; id: string; name: string } | { kind: "unassigned" };
interface Filters {
  person: PersonFilter;
  roles: MemberRole[];
  statuses: TaskStatus[];
  phases: string[];
  hideDone: boolean;
}
const NO_FILTERS: Filters = { person: { kind: "everyone" }, roles: [], statuses: [], phases: [], hideDone: false };

function matches(t: Task, f: Filters, myMemberId: string): boolean {
  if (f.hideDone && t.status === "done") return false;
  if (f.person.kind === "mine" && t.assigneeMemberId !== myMemberId) return false;
  if (f.person.kind === "member" && t.assigneeMemberId !== f.person.id) return false;
  if (f.person.kind === "unassigned" && t.assigneeMemberId) return false;
  if (f.roles.length && (!t.roleKey || !f.roles.includes(t.roleKey))) return false;
  if (f.statuses.length && !f.statuses.includes(t.status)) return false;
  if (f.phases.length && !f.phases.includes(t.phase)) return false;
  return true;
}

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ProjectTimelineView() {
  const { data, isLoading, ws, projectId, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [mode, setMode] = useState<"list" | "gantt">("list");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Filters stick per project so coming back from a task keeps the view.
  const [filters, setFilters] = usePersistedState<Filters>(`fletcher:${ws.slug}:timeline-filters:${projectId}`, NO_FILTERS);
  const members = useMembers();
  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const activeCount = (filters.person.kind !== "everyone" ? 1 : 0) + filters.roles.length + filters.statuses.length + filters.phases.length + (filters.hideDone ? 1 : 0);
  const [adding, setAdding] = useState(false);
  const today = todayISO();
  const { setTaskId } = useTaskParam();

  const createFromMilestone = useMutation(trpc.tasks.createProjectFromMilestone.mutationOptions({ onSuccess: async (p) => { await invalidate(); toast.success(`${p.name} created`); }, onError: (e) => toast.error(e.message) }));

  const visible = useMemo(() => (data?.tasks ?? []).filter((t) => matches(t, filters, ws.memberId)), [data, filters, ws.memberId]);
  const groups = useMemo(() => {
    if (!data) return [];
    const phaseTitle = new Map(data.phases.map((p) => [p.key, p.title]));
    const order = new Map(data.phases.map((p, i) => [p.key, i]));
    const map = new Map<string, Task[]>();
    for (const t of visible) map.set(t.phase, [...(map.get(t.phase) ?? []), t]);
    return [...map.entries()]
      .sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99))
      .map(([key, tasks]) => ({ key, title: phaseTitle.get(key) ?? key, tasks: tasks.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")) }));
  }, [data, visible]);

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;
  const { project, warnings } = data;
  const warningsByTask = new Map<string, string[]>();
  for (const w of warnings) warningsByTask.set(w.taskId, [...(warningsByTask.get(w.taskId) ?? []), w.message]);

  return (
    <div className="fade-in-up">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as "list" | "gantt")} variant="outline" size="sm">
            <ToggleGroupItem value="list" aria-label="List"><List />List</ToggleGroupItem>
            <ToggleGroupItem value="gantt" aria-label="Gantt"><GanttChart />Gantt</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground">Offsets are relative to the {project.anchorLabel.toLowerCase()}</span>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus />Task</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1">
        <FilterChip active={filters.person.kind === "mine"} onClick={() => patch({ person: filters.person.kind === "mine" ? { kind: "everyone" } : { kind: "mine" } })}><MemberAvatar name={ws.userName} size="xs" showTooltip={false} className="size-4 text-[8px] ring-0" />Mine</FilterChip>
        <FilterChip active={filters.person.kind === "everyone"} onClick={() => patch({ person: { kind: "everyone" } })}><Users className="size-3.5" />Everyone</FilterChip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={chipClass(filters.person.kind === "member" || filters.person.kind === "unassigned")}>
              {filters.person.kind === "member" ? <><MemberAvatar name={filters.person.name} size="xs" showTooltip={false} className="size-4 text-[8px] ring-0" />{filters.person.name.split(" ")[0]}</> : filters.person.kind === "unassigned" ? "Unassigned" : "Person"}
              <ChevronDown className="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Assigned to</DropdownMenuLabel>
            {(members.data ?? []).filter((m) => m.id !== ws.memberId).map((m) => (
              <DropdownMenuItem key={m.id} onClick={() => patch({ person: { kind: "member", id: m.id, name: m.name } })}>
                <MemberAvatar name={m.name} size="xs" showTooltip={false} />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="text-2xs text-muted-foreground">{MEMBER_ROLE_LABELS[m.role]}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => patch({ person: { kind: "unassigned" } })}><MemberAvatar name={null} size="xs" showTooltip={false} />Unassigned</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-1 h-4 w-px bg-border" />
        <MultiChip label="Role" values={filters.roles} labelOf={(r) => MEMBER_ROLE_LABELS[r]} options={MEMBER_ROLES.filter((r) => data.tasks.some((t) => t.roleKey === r))} onToggle={(r) => patch({ roles: toggleIn(filters.roles, r) })} />
        <MultiChip label="Status" values={filters.statuses} labelOf={(s) => TASK_STATUS_LABELS[s]} options={[...TASK_STATUSES]} onToggle={(s) => patch({ statuses: toggleIn(filters.statuses, s) })} />
        {data.phases.length > 1 && <MultiChip label="Phase" values={filters.phases} labelOf={(k) => data.phases.find((p) => p.key === k)?.title ?? k} options={data.phases.map((p) => p.key)} onToggle={(k) => patch({ phases: toggleIn(filters.phases, k) })} />}
        <FilterChip active={filters.hideDone} onClick={() => patch({ hideDone: !filters.hideDone })}>Hide done</FilterChip>
        {activeCount > 0 && (
          <>
            <span className="ml-1 text-2xs text-muted-foreground">{visible.length} of {data.tasks.length}</span>
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setFilters(NO_FILTERS)}><X />Clear</Button>
          </>
        )}
      </div>

      {warnings.filter((w) => w.severity === "error").length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div>
            {warnings.filter((w) => w.severity === "error").slice(0, 3).map((w, i) => <div key={i}>{w.message}</div>)}
          </div>
        </div>
      )}

      {data.tasks.length === 0 ? (
        <EmptyState title="No tasks" description="This project has no timeline template. Add tasks by hand." action={<Button size="sm" onClick={() => setAdding(true)}>Add task</Button>} />
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing matches" description="No tasks match these filters." action={<Button variant="outline" size="sm" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>} />
      ) : mode === "list" ? (
        <div className="surface overflow-hidden">
          {groups.map((g) => {
            const done = g.tasks.filter((t) => t.status === "done").length;
            const isCollapsed = collapsed[g.key];
            return (
              <div key={g.key}>
                <button onClick={() => setCollapsed({ ...collapsed, [g.key]: !isCollapsed })} className="flex w-full items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5 text-left">
                  {isCollapsed ? <ChevronRight className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
                  <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</span>
                  <span className="tabular text-2xs text-muted-foreground">{done}/{g.tasks.length}</span>
                </button>
                {!isCollapsed && g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} anchor={project.anchorDate} today={today} warnings={warningsByTask.get(t.id)} ws={ws.slug} onOpen={() => setTaskId(t.id)} onCreateChild={() => createFromMilestone.mutate({ workspace: ws.slug, taskId: t.id })} creating={createFromMilestone.isPending} />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <Gantt tasks={visible} phases={data.phases} anchor={project.anchorDate} anchorLabel={project.anchorLabel} today={today} />
      )}
      <AddTaskDialog open={adding} onOpenChange={setAdding} phases={data.phases} projectId={projectId} />
    </div>
  );
}

/** A chip that opens a checklist; reads "Role" when nothing is picked, the picks when a few are, and a count past that. */
function MultiChip<T extends string>({ label, values, options, labelOf, onToggle }: { label: string; values: T[]; options: T[]; labelOf: (v: T) => string; onToggle: (v: T) => void }) {
  const text = values.length === 0 ? label : values.length <= 2 ? values.map(labelOf).join(", ") : `${label} · ${values.length}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={chipClass(values.length > 0)}>{text}<ChevronDown className="size-3" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((o) => (
          <DropdownMenuCheckboxItem key={o} checked={values.includes(o)} onCheckedChange={() => onToggle(o)} onSelect={(e) => e.preventDefault()}>{labelOf(o)}</DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskRow({ task, anchor, today, warnings, ws, onOpen, onCreateChild, creating }: { task: Task; anchor: string; today: string; warnings?: string[]; ws: string; onOpen: () => void; onCreateChild: () => void; creating: boolean }) {
  const overdue = !!task.dueDate && task.dueDate < today && task.status !== "done";
  const milestone = task.milestone as { projectType: string; label: string } | null;
  return (
    <div
      id={task.id}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(); }}
      className={cn("group flex cursor-pointer items-center gap-3 border-b border-border px-3 py-1.5 transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none", task.status === "done" && "opacity-60")}
    >
      <span className="tabular w-14 shrink-0 font-mono text-2xs text-muted-foreground">{offsetLabel(task.dueDate, anchor)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-[13px] font-medium", task.status === "done" && "line-through")}>{task.title}</span>
          {task.checklistTotal > 0 && <span className={cn("inline-flex items-center gap-0.5 text-2xs text-muted-foreground", task.checklistDone === task.checklistTotal && "text-success")}><ListChecks className="size-3" />{task.checklistDone}/{task.checklistTotal}</span>}
          {task.attachmentCount > 0 && <span className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground"><Paperclip className="size-3" />{task.attachmentCount}</span>}
          {task.commentCount > 0 && <span className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground"><MessageSquare className="size-3" />{task.commentCount}</span>}
          {task.deliverableId && (
            <Link href={`/w/${ws}/deliverables/${task.deliverableId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-1.5 text-2xs font-medium text-brand hover:underline"><Film className="size-3" />Review</Link>
          )}
          {milestone && !task.childProjectId && (
            <button onClick={(e) => { e.stopPropagation(); onCreateChild(); }} disabled={creating} className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 text-2xs font-medium text-muted-foreground hover:border-brand hover:text-brand"><Sparkles className="size-3" />Create {milestone.label} project</button>
          )}
          {milestone && task.childProjectId && (
            <Link href={`/w/${ws}/projects/${task.childProjectId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 text-2xs font-medium hover:underline">Open {milestone.label}</Link>
          )}
          {warnings && warnings.length > 0 && (
            <Tooltip>
              <TooltipTrigger><AlertTriangle className="size-3.5 text-warning" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">{warnings.join(" ")}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {task.description && <div className="truncate text-2xs text-muted-foreground">{task.description}</div>}
      </div>
      <RolePill role={task.roleKey} className="hidden lg:inline-flex" />
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <StatusSelect taskId={task.id} status={task.status} />
        <DatePill taskId={task.id} dueDate={task.dueDate} isOverridden={task.isDateOverridden} overdue={overdue} className="w-[92px] justify-end" />
        <AssigneePicker taskId={task.id} assigneeMemberId={task.assigneeMemberId} assigneeName={task.assigneeName} roleKey={task.roleKey} />
      </div>
    </div>
  );
}

const STATUS_BAR: Record<TaskStatus, string> = { todo: "bg-foreground/25", in_progress: "bg-info", in_review: "bg-brand", blocked: "bg-danger", done: "bg-success" };

function Gantt({ tasks, phases, anchor, anchorLabel, today }: { tasks: Task[]; phases: { key: string; title: string }[]; anchor: string; anchorLabel: string; today: string }) {
  const dated = tasks.filter((t) => t.dueDate);
  if (!dated.length) return <EmptyState title="No dated tasks" />;
  const min = dated.reduce((m, t) => ((t.startDate ?? t.dueDate!) < m ? (t.startDate ?? t.dueDate!) : m), dated[0]!.dueDate!);
  const max = dated.reduce((m, t) => (t.dueDate! > m ? t.dueDate! : m), dated[0]!.dueDate!);
  const start = addDaysISO(min, -3);
  const end = addDaysISO(max, 4);
  const totalDays = Math.max(1, diffDaysISO(end, start));
  const pxPerDay = 18;
  const width = totalDays * pxPerDay;
  const x = (iso: string) => diffDaysISO(iso, start) * pxPerDay;
  const weeks: string[] = [];
  for (let d = start; d < end; d = addDaysISO(d, 7)) weeks.push(d);
  const order = new Map(phases.map((p, i) => [p.key, i]));
  const rows = [...dated].sort((a, b) => (order.get(a.phase) ?? 99) - (order.get(b.phase) ?? 99) || a.dueDate!.localeCompare(b.dueDate!));
  const labelW = 260;

  return (
    <div className="surface overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <div style={{ width: labelW + width }} className="relative">
          <div className="sticky top-0 z-10 flex border-b border-border bg-card">
            <div style={{ width: labelW }} className="shrink-0 border-r border-border px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Task</div>
            <div className="relative h-7" style={{ width }}>
              {weeks.map((w) => (
                <div key={w} className="absolute top-0 h-full border-l border-border pl-1 text-2xs text-muted-foreground" style={{ left: x(w), width: pxPerDay * 7 }}>{fmtDate(w)}</div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 z-0" style={{ left: labelW + x(anchor), width: 2 }}>
              <div className="h-full w-full bg-brand/70" />
              <span className="absolute -top-0 left-1.5 rounded bg-brand px-1 text-[9px] font-semibold text-brand-foreground">{anchorLabel}</span>
            </div>
            {today >= start && today <= end && <div className="pointer-events-none absolute inset-y-0 z-0 border-l border-dashed border-danger/60" style={{ left: labelW + x(today) }} />}
            {rows.map((t, i) => {
              const s = t.startDate ?? t.dueDate!;
              const left = x(s);
              const w = Math.max(pxPerDay * 0.8, (diffDaysISO(t.dueDate!, s) + 1) * pxPerDay - 4);
              const showPhase = i === 0 || rows[i - 1]!.phase !== t.phase;
              return (
                <div key={t.id}>
                  {showPhase && <div className="border-b border-border bg-muted/50 px-3 py-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ width: labelW + width }}>{phases.find((p) => p.key === t.phase)?.title ?? t.phase}</div>}
                  <div className="flex h-7 items-center border-b border-border/60">
                    <div style={{ width: labelW }} className="sticky left-0 z-[1] flex h-full shrink-0 items-center gap-2 border-r border-border bg-card px-3">
                      <span className={cn("truncate text-xs", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                    </div>
                    <div className="relative h-full" style={{ width }}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn("absolute top-1.5 h-4 rounded-[4px]", STATUS_BAR[t.status], t.isDateOverridden && "ring-1 ring-warning")} style={{ left, width: w }} />
                        </TooltipTrigger>
                        <TooltipContent>{t.title} · {fmtDate(s)} → {fmtDate(t.dueDate)}{t.assigneeName ? ` · ${t.assigneeName}` : ""}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTaskDialog({ open, onOpenChange, phases, projectId }: { open: boolean; onOpenChange: (o: boolean) => void; phases: { key: string; title: string }[]; projectId: string }) {
  const ws = useWorkspace();
  const { trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState(phases[0]?.key ?? "general");
  const [dueDate, setDueDate] = useState("");
  const create = useMutation(trpc.tasks.create.mutationOptions({ onSuccess: async () => { await invalidate(); onOpenChange(false); setTitle(""); setDueDate(""); toast.success("Task added"); }, onError: (e) => toast.error(e.message) }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add task</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Title</Label><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deliver Dolby Atmos mix" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Phase</Label>
              <Select value={phase} onValueChange={setPhase}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{phases.map((p) => <SelectItem key={p.key} value={p.key}>{p.title}</SelectItem>)}{!phases.some((p) => p.key === "general") && <SelectItem value="general">General</SelectItem>}</SelectContent></Select>
            </div>
            <div className="grid gap-1"><Label>Due</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="tabular" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate({ workspace: ws.slug, projectId, title: title.trim(), phase, dueDate: dueDate || null })}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
