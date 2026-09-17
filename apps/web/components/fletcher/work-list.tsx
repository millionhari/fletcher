"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, FolderKanban, ListTodo, Megaphone, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDate, fmtTime, relativeDays } from "@/lib/format";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useMembers } from "@/lib/hooks/use-project-data";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SectionHeader } from "@/components/fletcher/page-header";
import { TaskStatusBadge } from "@/components/fletcher/status-badge";
import { MemberAvatar } from "@/components/fletcher/member-avatar";


type Filter = { kind: "mine" } | { kind: "everyone" } | { kind: "member"; id: string; name: string };

/** Open tasks + rollout items for one person or everyone, grouped by urgency, with knock-it-out checkboxes. */
export function WorkList() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const members = useMembers();
  const [filter, setFilter, hydrated] = usePersistedState<Filter>(`fletcher:${ws.slug}:work-filter`, { kind: "mine" });
  const [showDone, setShowDone] = usePersistedState<boolean>(`fletcher:${ws.slug}:work-show-done`, true);
  const [projectId, setProjectId] = usePersistedState<string | null>(`fletcher:${ws.slug}:work-project`, null);
  const projects = useQuery(trpc.projects.list.queryOptions({ workspace: ws.slug, includeArchived: false }));
  const selectedProject = (projects.data ?? []).find((p) => p.id === projectId) ?? null;
  const memberId = filter.kind === "mine" ? ws.memberId : filter.kind === "member" ? filter.id : null;
  const q = useQuery({ ...trpc.dashboard.workFor.queryOptions({ workspace: ws.slug, memberId, includeDone: showDone }), enabled: hydrated });
  /** Optimistic done-state overrides until the refetch lands. */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const base = `/w/${ws.slug}`;

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: trpc.dashboard.workFor.queryKey() }),
    qc.invalidateQueries({ queryKey: trpc.dashboard.overview.queryKey() }),
    qc.invalidateQueries({ queryKey: trpc.projects.get.queryKey() }),
    qc.invalidateQueries({ queryKey: trpc.comms.getPlan.queryKey() }),
  ]);
  const settle = (id: string) => async () => { await refresh(); setPending((p) => { const { [id]: _, ...rest } = p; return rest; }); };
  const doneTask = useMutation(trpc.tasks.update.mutationOptions({ onError: (e) => toast.error(e.message) }));
  const doneItem = useMutation(trpc.comms.toggleItem.mutationOptions({ onError: (e) => toast.error(e.message) }));
  const toggle = (row: { kind: "task" | "item"; id: string }, next: boolean) => {
    setPending((p) => ({ ...p, [row.id]: next }));
    if (row.kind === "task") doneTask.mutate({ workspace: ws.slug, taskId: row.id, status: next ? "done" : "todo" }, { onSettled: settle(row.id) });
    else doneItem.mutate({ workspace: ws.slug, itemId: row.id, isDone: next }, { onSettled: settle(row.id) });
  };

  const visible = useMemo(() => (q.data?.items ?? []).filter((i) => !projectId || i.projectId === projectId), [q.data, projectId]);
  const counts = useMemo(() => {
    const open = visible.filter((i) => !i.done);
    return { tasks: open.filter((i) => i.kind === "task").length, items: open.filter((i) => i.kind === "item").length, done: visible.length - open.length, overdue: open.filter((i) => i.bucket === "overdue").length, today: open.filter((i) => i.bucket === "today").length, week: open.filter((i) => i.bucket === "week").length };
  }, [visible]);
  /** Overdue first, then one group per due date, then undated. Done rows sink to the bottom of their group. */
  const groups = useMemo(() => {
    const byDone = (a: { done: boolean }, c: { done: boolean }) => Number(a.done) - Number(c.done);
    const out: { key: string; label: string; sub?: string; tone: string; overdue?: boolean; rows: typeof visible }[] = [];
    const overdue = visible.filter((i) => i.bucket === "overdue").sort(byDone);
    if (overdue.length) out.push({ key: "overdue", label: "Overdue", tone: "text-danger", overdue: true, rows: overdue });
    const dated = new Map<string, typeof visible>();
    for (const i of visible) if (i.date && i.bucket !== "overdue") dated.set(i.date, [...(dated.get(i.date) ?? []), i]);
    for (const [date, rows] of [...dated.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      out.push({ key: date, label: fmtDate(date, "weekday"), sub: relativeDays(date), tone: date === q.data?.today ? "text-foreground" : "text-muted-foreground", rows: rows.sort(byDone) });
    }
    const undated = visible.filter((i) => !i.date).sort(byDone);
    if (undated.length) out.push({ key: "undated", label: "No date", tone: "text-muted-foreground", rows: undated });
    return out;
  }, [visible, q.data?.today]);

  const showPerson = filter.kind === "everyone";
  const label = filter.kind === "mine" ? "My work" : filter.kind === "everyone" ? "Everyone's work" : `${filter.name.split(" ")[0]}'s work`;

  return (
    <section>
      <SectionHeader
        title={<span className="flex items-center gap-1.5"><ListTodo className="size-3.5" />{label}</span>}
        count={q.data ? visible.length : undefined}
        actions={
          <div className="flex items-center gap-1">
            <label className="mr-2 flex items-center gap-1.5 text-2xs text-muted-foreground"><Switch checked={showDone} onCheckedChange={setShowDone} className="scale-75" />Show done</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(chipClass(!!selectedProject), "mr-2")}>
                  {selectedProject ? <><span className="size-2 rounded-[3px]" style={{ background: selectedProject.color }} />{selectedProject.name}</> : <><FolderKanban className="size-3.5" />All projects</>}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Project</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setProjectId(null)}><FolderKanban className="text-muted-foreground" />All projects</DropdownMenuItem>
                <DropdownMenuSeparator />
                {(projects.data ?? []).map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => setProjectId(p.id)} className={cn(p.parentProjectId && "pl-6")}>
                    <span className="size-2 rounded-[3px]" style={{ background: p.color }} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FilterChip active={filter.kind === "mine"} onClick={() => setFilter({ kind: "mine" })}><MemberAvatar name={ws.userName} size="xs" showTooltip={false} className="size-4 text-[8px] ring-0" />Mine</FilterChip>
            <FilterChip active={filter.kind === "everyone"} onClick={() => setFilter({ kind: "everyone" })}><Users className="size-3.5" />Everyone</FilterChip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={chipClass(filter.kind === "member")}>
                  {filter.kind === "member" ? <><MemberAvatar name={filter.name} size="xs" showTooltip={false} className="size-4 text-[8px] ring-0" />{filter.name.split(" ")[0]}</> : "Person"}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Show work for</DropdownMenuLabel>
                {(members.data ?? []).filter((m) => m.id !== ws.memberId).map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => setFilter({ kind: "member", id: m.id, name: m.name })}>
                    <MemberAvatar name={m.name} size="xs" showTooltip={false} />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    <span className="text-2xs text-muted-foreground">{m.role.replace("_", " ")}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilter({ kind: "mine" })}>Back to mine</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      {q.isLoading || !q.data ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : visible.length === 0 ? (
        <div className="surface flex items-center gap-3 px-4 py-5 text-xs text-muted-foreground"><CheckCircle2 className="size-4 text-success" />{selectedProject ? `Nothing here for ${selectedProject.name}.` : filter.kind === "mine" ? "Nothing assigned to you is open." : filter.kind === "everyone" ? "No open, assigned work in the next 60 days." : `Nothing open is assigned to ${filter.name}.`}</div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-3 px-1 text-2xs text-muted-foreground">
            {counts.overdue > 0 && <span className="font-medium text-danger">{counts.overdue} overdue</span>}
            {counts.today > 0 && <span className="font-medium text-foreground">{counts.today} today</span>}
            {counts.week > 0 && <span>{counts.week} this week</span>}
            <span>{counts.tasks} tasks · {counts.items} rollout items open</span>
            {counts.done > 0 && <span className="text-success">{counts.done} done</span>}
          </div>
          <div className="space-y-4">
            {groups.map((g) => {
              return (
                <div key={g.key}>
                  <div className="mb-1.5 flex items-baseline gap-2 px-1">
                    <span className={cn("text-xs font-semibold", g.tone, g.overdue && "uppercase tracking-wider")}>{g.label}</span>
                    {g.sub && <span className="text-2xs text-muted-foreground">{g.sub}</span>}
                  </div>
                  <div className="surface divide-y divide-border">
                  {g.rows.map((row) => {
                    const done = pending[row.id] ?? row.done;
                    const href = row.kind === "task" ? `${base}/projects/${row.projectId}/timeline?task=${row.id}` : `${base}/projects/${row.projectId}/comms#${row.momentId}`;
                    return (
                      <div key={`${row.kind}-${row.id}`} className={cn("group flex items-center gap-3 px-3 py-1.5 transition-all hover:bg-muted/40", done && "opacity-40")}>
                        <Checkbox checked={done} onCheckedChange={(v) => toggle(row, !!v)} aria-label={done ? "Mark not done" : "Mark done"} />
                        <span className="size-2 shrink-0 rounded-[3px]" style={{ background: row.projectColor }} />
                        <Link href={href} className="min-w-0 flex-1">
                          <span className={cn("block truncate text-[13px] font-medium", done && "line-through")}>{row.title}</span>
                          <span className="flex items-center gap-1 truncate text-2xs text-muted-foreground">
                            {row.kind === "item" && <Megaphone className="size-2.5" />}
                            {row.projectName}
                            {row.kind === "item" ? <> · {row.momentTitle}</> : row.phase ? <> · {row.phase}</> : null}
                          </span>
                        </Link>
                        {row.kind === "task" && row.status && <TaskStatusBadge status={done ? "done" : row.status === "done" ? "todo" : row.status} />}
                        <span className={cn("tabular w-24 shrink-0 text-right text-xs", g.overdue && !done ? "font-medium text-danger" : "text-muted-foreground")}>
                          {row.date ? (g.overdue ? relativeDays(row.date) : row.time ? fmtTime(row.time) : fmtDate(row.date)) : "—"}
                        </span>
                        {showPerson && <MemberAvatar name={row.personName} size="xs" />}
                      </div>
                    );
                  })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function chipClass(active: boolean): string {
  return cn("box-border inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0 text-xs font-medium leading-none transition-colors", active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground");
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={chipClass(active)}>
      {children}
    </button>
  );
}
