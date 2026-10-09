"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtBytes, PLAN_LABELS, PLANS, PROJECT_TYPE_LABELS, type Plan } from "@fletcher/core";
import { fmtDateYear } from "@/lib/format";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, SectionHeader } from "@/components/fletcher/page-header";
import { EmptyState } from "@/components/fletcher/empty-state";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { Pill, ProjectStatusBadge } from "@/components/fletcher/status-badge";
import { Progress } from "@/components/ui/progress";

type Overview = NonNullable<ReturnType<typeof useAdmin>["data"]>;
type Workspace = Overview["workspaces"][number];

function useAdmin() {
  const trpc = useTRPC();
  return useQuery(trpc.admin.overview.queryOptions());
}

export function AdminView() {
  const q = useAdmin();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (q.isLoading || !q.data) return <Skeleton className="h-96 rounded-xl" />;
  const { workspaces, users } = q.data;
  const totals = { workspaces: workspaces.length, users: users.length, projects: workspaces.reduce((n, w) => n + w.projects.length, 0), bytes: workspaces.reduce((n, w) => n + w.usedBytes, 0) };

  return (
    <div className="fade-in-up space-y-8">
      <PageHeader title="Admin" description="Every workspace on Fletcher, who runs it, and the plan it's on. Plan changes here take effect immediately." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Workspaces", totals.workspaces], ["Users", totals.users], ["Projects", totals.projects], ["Storage used", fmtBytes(totals.bytes)]].map(([label, value]) => (
          <div key={label as string} className="surface p-4"><div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="tabular mt-1 text-xl font-semibold">{value}</div></div>
        ))}
      </div>

      <section>
        <SectionHeader title="Workspaces" count={workspaces.length} />
        {workspaces.length === 0 ? (
          <EmptyState title="No workspaces yet" description="They appear here as people sign up and create one." />
        ) : (
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead className="w-[28%]">Workspace</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead className="w-44">Storage</TableHead>
                  <TableHead className="w-64">Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((w) => (
                  <WorkspaceRows key={w.id} w={w} open={open.has(w.id)} onToggle={() => toggle(w.id)} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Users" count={users.length} />
        {users.length === 0 ? (
          <EmptyState title="No users yet" />
        ) : (
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[32%]">User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Workspaces</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <MemberAvatar name={u.name} size="sm" showTooltip={false} />
                        <div className="min-w-0"><div className="truncate font-medium">{u.name}</div><div className="truncate text-2xs text-muted-foreground">{u.email}</div></div>
                      </div>
                    </TableCell>
                    <TableCell>{u.active ? <Pill tone="success" dot={false}>Active</Pill> : <Pill tone="warning" dot={false}>Invited</Pill>}</TableCell>
                    <TableCell>
                      {u.workspaces.length === 0 ? <span className="text-muted-foreground">—</span> : (
                        <div className="flex flex-wrap gap-1">
                          {u.workspaces.map((w) => <Link key={w.id} href={`/w/${w.slug}`} className="rounded-md bg-muted px-1.5 py-0.5 text-2xs font-medium hover:bg-muted/70">{w.name} <span className="capitalize text-muted-foreground">· {w.permission}</span></Link>)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateYear(u.createdAt.toISOString().slice(0, 10))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function WorkspaceRows({ w, open, onToggle }: { w: Workspace; open: boolean; onToggle: () => void }) {
  const pct = Math.min(100, (w.usedBytes / w.quotaBytes) * 100);
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="text-muted-foreground">{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</TableCell>
        <TableCell>
          <div className="min-w-0">
            <Link href={`/w/${w.slug}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:underline">{w.name}</Link>
            <div className="truncate text-2xs text-muted-foreground">{w.artistName} · /{w.slug} · since {fmtDateYear(w.createdAt.toISOString().slice(0, 10))}</div>
          </div>
        </TableCell>
        <TableCell>{w.owner ? <div className="min-w-0"><div className="truncate">{w.owner.name}</div><div className="truncate text-2xs text-muted-foreground">{w.owner.email}</div></div> : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="tabular">{w.members.length}</TableCell>
        <TableCell className="tabular">{w.projects.length}</TableCell>
        <TableCell>
          <div className="tabular text-xs">{fmtBytes(w.usedBytes)} <span className="text-muted-foreground">of {fmtBytes(w.quotaBytes)}</span></div>
          <Progress value={pct} className={cn("mt-1 h-1", pct >= 100 && "[&>[data-slot=progress-indicator]]:bg-danger")} />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}><PlanEditor w={w} /></TableCell>
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell />
          <TableCell colSpan={6} className="py-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Team</div>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {w.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                      <MemberAvatar name={m.name} size="xs" showTooltip={false} />
                      <span className="min-w-0 flex-1 truncate">{m.name} <span className="text-muted-foreground">· {m.email}</span></span>
                      <span className="capitalize text-2xs text-muted-foreground">{m.permission}</span>
                      {!m.active && <Pill tone="warning" dot={false}>Invited</Pill>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Projects</div>
                {w.projects.length === 0 ? <p className="rounded-lg border border-dashed border-border px-2.5 py-3 text-2xs text-muted-foreground">No projects yet.</p> : (
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {w.projects.map((p) => (
                      <Link key={p.id} href={`/w/${w.slug}/projects/${p.id}`} className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/50">
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <span className="text-2xs text-muted-foreground">{PROJECT_TYPE_LABELS[p.type]}</span>
                        <ProjectStatusBadge status={p.status} />
                        <span className="tabular text-2xs text-muted-foreground">{fmtDateYear(p.anchorDate)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** Free / Pro / Custom, with a GB box for custom. Saves on change; custom saves on Enter or blur. */
function PlanEditor({ w }: { w: Workspace }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [plan, setPlan] = useState<Plan>(w.plan as Plan);
  const [gb, setGb] = useState(String(w.customQuotaGb ?? 500));
  const save = useMutation(trpc.admin.setPlan.mutationOptions({
    onSuccess: async (row) => { await qc.invalidateQueries({ queryKey: trpc.admin.pathKey() }); toast.success(`${w.name} is now on ${PLAN_LABELS[row.plan as Plan]}${row.plan === "custom" ? ` (${row.customQuotaGb} GB)` : ""}`); },
    onError: (e) => toast.error(e.message),
  }));
  const commit = (next: Plan, customGb?: number) => save.mutate({ workspaceId: w.id, plan: next, customQuotaGb: next === "custom" ? customGb ?? Number(gb) : null });
  return (
    <div className="flex items-center gap-1.5">
      <Select value={plan} onValueChange={(v) => { const p = v as Plan; setPlan(p); if (p !== "custom") commit(p); }}>
        <SelectTrigger size="sm" className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{PLANS.map((p) => <SelectItem key={p} value={p}>{PLAN_LABELS[p]}{p === "free" ? " · 2 GB" : p === "paid" ? " · 100 GB" : ""}</SelectItem>)}</SelectContent>
      </Select>
      {plan === "custom" && (
        <div className="flex items-center gap-1">
          <Input type="number" min={1} value={gb} onChange={(e) => setGb(e.target.value)} onBlur={() => Number(gb) > 0 && Number(gb) !== w.customQuotaGb && commit("custom", Number(gb))} onKeyDown={(e) => { if (e.key === "Enter") commit("custom", Number(gb)); }} className="tabular h-7 w-20 text-xs" aria-label="Custom quota in GB" />
          <span className="text-2xs text-muted-foreground">GB</span>
        </div>
      )}
      {save.isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      {!save.isPending && plan === "custom" && Number(gb) !== w.customQuotaGb && <Button size="xs" variant="outline" onClick={() => commit("custom", Number(gb))}>Save</Button>}
    </div>
  );
}
