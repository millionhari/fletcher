"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ClipboardList, Link2, Megaphone, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDate, fmtTime, pct, relativeDays } from "@/lib/format";
import { MOMENT_STATUSES, PLATFORMS, PLATFORM_LABELS, todayISO, type Platform, type MomentStatus } from "@fletcher/core";
import type { ItemNode } from "@fletcher/api";
import { useProjectData, useInvalidateProject, useMembers } from "@/lib/hooks/use-project-data";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlatformIcon, PlatformLabel } from "@/components/fletcher/platform-icon";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { MomentStatusBadge } from "@/components/fletcher/status-badge";
import { ProgressBar } from "@/components/fletcher/progress-ring";
import { SectionHeader } from "@/components/fletcher/page-header";
import { EmptyState } from "@/components/fletcher/empty-state";

type Plan = NonNullable<ReturnType<typeof usePlan>["data"]>;
type Moment = Plan["moments"][number];

function usePlan() {
  const { ws, projectId, trpc } = useProjectData();
  return useQuery(trpc.comms.getPlan.queryOptions({ workspace: ws.slug, projectId }));
}

export function ProjectCommsView() {
  const { data, isLoading, ws, projectId, trpc } = useProjectData();
  const plan = usePlan();
  const invalidate = useInvalidateProject();
  const members = useMembers();
  const [adding, setAdding] = useState(false);
  const today = todayISO();

  const assignPlatform = useMutation(trpc.comms.assignPlatform.mutationOptions({ onSuccess: async (r) => { await invalidate(); toast.success(`${r.updated} items assigned`); }, onError: (e) => toast.error(e.message) }));

  if (isLoading || plan.isLoading || !data || !plan.data) return <Skeleton className="h-96 rounded-xl" />;
  const moments = plan.data.moments.filter((m) => !m.isChecklist);
  const checklists = plan.data.moments.filter((m) => m.isChecklist);
  const platformsInPlan = [...new Set(plan.data.moments.flatMap((m) => flatten(m.items).map((i) => i.platform)))];

  return (
    <div className="fade-in-up">
      {moments.length === 0 && checklists.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No comms plan yet" description="Add rollout moments by hand or create the project from a template that includes one." action={<Button size="sm" onClick={() => setAdding(true)}>Add moment</Button>} />
      ) : (
        <>
          <section className="mb-8">
            <SectionHeader
              title="Overview"
              actions={
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><UserPlus />Assign platform</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Assign every item on a platform to…</DropdownMenuLabel>
                      {platformsInPlan.map((p) => (
                        <DropdownMenu key={p}>
                          <PlatformAssignRow platform={p} members={members.data ?? []} onPick={(memberId) => assignPlatform.mutate({ workspace: ws.slug, projectId, platform: p, ownerMemberId: memberId })} />
                        </DropdownMenu>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" onClick={() => setAdding(true)}><Plus />Moment</Button>
                </div>
              }
            />
            <div className="surface overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/50 text-2xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-3 py-1.5 text-left font-semibold">Date</th><th className="px-3 py-1.5 text-left font-semibold">Time</th><th className="px-3 py-1.5 text-left font-semibold">Activity</th><th className="px-3 py-1.5 text-left font-semibold">CTA</th><th className="w-40 px-3 py-1.5 text-left font-semibold">Progress</th><th className="px-3 py-1.5 text-left font-semibold">Status</th></tr>
                </thead>
                <tbody>
                  {moments.map((m) => (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/40">
                      <td className="tabular whitespace-nowrap px-3 py-1.5 font-medium"><a href={`#${m.id}`} className="hover:underline">{fmtDate(m.scheduledDate, "weekday")}</a> <span className="text-2xs font-normal text-muted-foreground">{relativeDays(m.scheduledDate)}</span></td>
                      <td className="tabular whitespace-nowrap px-3 py-1.5 text-muted-foreground">{fmtTime(m.scheduledTime)}{m.timezone ? ` ${tzAbbr(m.timezone)}` : ""}</td>
                      <td className="px-3 py-1.5 font-medium">{m.title}</td>
                      <td className="max-w-[280px] truncate px-3 py-1.5 text-muted-foreground">{m.cta}</td>
                      <td className="px-3 py-1.5"><div className="flex items-center gap-2"><ProgressBar value={pct(m.progress.done, m.progress.total)} className="w-20" /><span className="tabular text-2xs text-muted-foreground">{m.progress.done}/{m.progress.total}</span></div></td>
                      <td className="px-3 py-1.5"><MomentStatusBadge status={m.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {checklists.length > 0 && (
            <section className="mb-8">
              <SectionHeader title={<span className="flex items-center gap-1.5"><ClipboardList className="size-3.5" />Standing checklists</span>} />
              <div className="grid gap-3 md:grid-cols-2">
                {checklists.map((m) => <MomentCard key={m.id} moment={m} today={today} deliverables={data.deliverables} />)}
              </div>
            </section>
          )}

          <section>
            <SectionHeader title="Rollout" count={moments.length} />
            <div className="space-y-3">
              {moments.map((m) => <MomentCard key={m.id} moment={m} today={today} deliverables={data.deliverables} />)}
            </div>
          </section>
        </>
      )}
      <AddMomentDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function PlatformAssignRow({ platform, members, onPick }: { platform: Platform; members: { id: string; name: string; role: string }[]; onPick: (id: string | null) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"><PlatformIcon platform={platform} size="xs" />{PLATFORM_LABELS[platform]}<ChevronRight className="ml-auto size-3 text-muted-foreground" /></button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-48 p-1">
        {members.map((m) => <button key={m.id} onClick={() => onPick(m.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"><MemberAvatar name={m.name} size="xs" showTooltip={false} />{m.name}</button>)}
        <button onClick={() => onPick(null)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted">Clear</button>
      </PopoverContent>
    </Popover>
  );
}

function flatten(items: ItemNode[]): ItemNode[] {
  return items.flatMap((i) => [i, ...flatten(i.children)]);
}

function tzAbbr(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function MomentCard({ moment, today, deliverables }: { moment: Moment; today: string; deliverables: { id: string; title: string; kind: string }[] }) {
  const { ws, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [open, setOpen] = useState(!moment.isChecklist && (moment.scheduledDate ?? "") >= today);
  const [editing, setEditing] = useState(false);
  const [addingItem, setAddingItem] = useState<{ parentId: string | null } | null>(null);
  const update = useMutation(trpc.comms.updateMoment.mutationOptions({ onSuccess: () => invalidate(), onError: (e) => toast.error(e.message) }));
  const remove = useMutation(trpc.comms.removeMoment.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("Moment removed"); }, onError: (e) => toast.error(e.message) }));
  const groups = useMemo(() => groupByPlatform(moment.items), [moment.items]);
  const done = pct(moment.progress.done, moment.progress.total);
  const past = !moment.isChecklist && !!moment.scheduledDate && moment.scheduledDate < today;

  return (
    <div id={moment.id} className={cn("surface overflow-hidden scroll-mt-20", moment.status === "posted" && "opacity-75")}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button onClick={() => setOpen(!open)} className="mt-1 text-muted-foreground" aria-label="Toggle">{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button>
        {!moment.isChecklist && (
          <div className="w-16 shrink-0 text-center">
            <div className="text-2xs uppercase tracking-wider text-muted-foreground">{moment.scheduledDate ? fmtDate(moment.scheduledDate).split(" ")[0] : "—"}</div>
            <div className="tabular text-xl font-semibold leading-6">{moment.scheduledDate ? fmtDate(moment.scheduledDate).split(" ")[1] : "·"}</div>
            <div className="tabular text-2xs text-muted-foreground">{fmtTime(moment.scheduledTime) || "—"}</div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{moment.title}</h3>
            {!moment.isChecklist && <MomentStatusBadge status={moment.status} />}
            {past && moment.status !== "posted" && moment.status !== "skipped" && <span className="text-2xs text-warning">past</span>}
          </div>
          {moment.cta && <p className="mt-0.5 text-[13px] text-foreground/80"><span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">CTA </span>{moment.cta}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted-foreground">
            {moment.assetNote && <span><span className="font-semibold uppercase tracking-wider">Asset </span>{moment.assetNote}</span>}
            {moment.assetDeliverableId && <a href={`/w/${ws.slug}/deliverables/${moment.assetDeliverableId}`} className="inline-flex items-center gap-1 text-brand hover:underline"><Link2 className="size-3" />{deliverables.find((d) => d.id === moment.assetDeliverableId)?.title ?? "Linked asset"}</a>}
            {moment.link && <a href={moment.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><Link2 className="size-3" />{moment.link}</a>}
          </div>
          {moment.copy && <p className="mt-2 whitespace-pre-line rounded-md bg-muted/60 px-2.5 py-1.5 text-xs leading-4">{moment.copy}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden w-28 items-center gap-2 sm:flex"><ProgressBar value={done} /><span className="tabular text-2xs text-muted-foreground">{done}%</span></div>
          {!moment.isChecklist && (
            <Select value={moment.status} onValueChange={(v) => update.mutate({ workspace: ws.slug, momentId: moment.id, status: v as MomentStatus })}>
              <SelectTrigger size="sm" className="h-7 w-[104px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{MOMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More">⋯</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>Edit details</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddingItem({ parentId: null })}><Plus />Add checklist item</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => { if (confirm(`Remove "${moment.title}"?`)) remove.mutate({ workspace: ws.slug, momentId: moment.id }); }}><Trash2 />Remove moment</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {open && (
        <div className="border-t border-border">
          {groups.length === 0 && <p className="px-4 py-3 text-xs text-muted-foreground">No checklist items. <button className="text-brand hover:underline" onClick={() => setAddingItem({ parentId: null })}>Add one.</button></p>}
          <div className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <div key={g.platform} className="border-b border-border px-4 py-2.5 md:[&:nth-child(2n)]:border-l xl:[&:nth-child(2n)]:border-l-0 xl:[&:nth-child(3n+2)]:border-l xl:[&:nth-child(3n)]:border-l">
                <div className="mb-1.5 flex items-center justify-between">
                  <PlatformLabel platform={g.platform} />
                  <span className="tabular text-2xs text-muted-foreground">{g.done}/{g.total}</span>
                </div>
                <ul className="space-y-0.5">
                  {g.items.map((it) => <ItemRow key={it.id} item={it} depth={0} momentId={moment.id} onAddChild={(parentId) => setAddingItem({ parentId })} />)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <EditMomentDialog open={editing} onOpenChange={setEditing} moment={moment} deliverables={deliverables} />
      <AddItemDialog open={!!addingItem} onOpenChange={(o) => !o && setAddingItem(null)} momentId={moment.id} parentItemId={addingItem?.parentId ?? null} />
    </div>
  );
}

function groupByPlatform(items: ItemNode[]): { platform: Platform; items: ItemNode[]; done: number; total: number }[] {
  const map = new Map<Platform, ItemNode[]>();
  for (const it of items) map.set(it.platform, [...(map.get(it.platform) ?? []), it]);
  return [...map.entries()].map(([platform, list]) => {
    const all = flatten(list);
    return { platform, items: list, done: all.filter((i) => i.isDone).length, total: all.length };
  });
}

function ItemRow({ item, depth, momentId, onAddChild }: { item: ItemNode; depth: number; momentId: string; onAddChild: (parentId: string) => void }) {
  const { ws, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const members = useMembers();
  const toggle = useMutation(trpc.comms.toggleItem.mutationOptions({ onSuccess: () => invalidate(), onError: (e) => toast.error(e.message) }));
  const updateItem = useMutation(trpc.comms.updateItem.mutationOptions({ onSuccess: () => invalidate(), onError: (e) => toast.error(e.message) }));
  const removeItem = useMutation(trpc.comms.removeItem.mutationOptions({ onSuccess: () => invalidate(), onError: (e) => toast.error(e.message) }));
  return (
    <li>
      <div className={cn("group flex items-start gap-2 rounded-md py-0.5 pr-1 hover:bg-muted/50", depth > 0 && "ml-5")}>
        <Checkbox checked={item.isDone} onCheckedChange={(v) => toggle.mutate({ workspace: ws.slug, itemId: item.id, isDone: !!v })} className="mt-0.5" />
        <span className={cn("min-w-0 flex-1 text-xs leading-4", item.isDone && "text-muted-foreground line-through")}>{item.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none" aria-label="Owner"><MemberAvatar name={item.ownerName} size="xs" showTooltip={false} className={cn(!item.ownerName && "opacity-40 group-hover:opacity-100")} /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {(members.data ?? []).map((m) => <DropdownMenuItem key={m.id} onClick={() => updateItem.mutate({ workspace: ws.slug, itemId: item.id, ownerMemberId: m.id })}><MemberAvatar name={m.name} size="xs" showTooltip={false} />{m.name}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => updateItem.mutate({ workspace: ws.slug, itemId: item.id, ownerMemberId: null })}>No owner</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddChild(item.id)}><Plus />Add sub-item</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => removeItem.mutate({ workspace: ws.slug, itemId: item.id })}><X />Remove</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {item.children.length > 0 && <ul className="space-y-0.5">{item.children.map((c) => <ItemRow key={c.id} item={c} depth={depth + 1} momentId={momentId} onAddChild={onAddChild} />)}</ul>}
    </li>
  );
}

function EditMomentDialog({ open, onOpenChange, moment, deliverables }: { open: boolean; onOpenChange: (o: boolean) => void; moment: Moment; deliverables: { id: string; title: string; kind: string }[] }) {
  const { ws, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [form, setForm] = useState({ title: moment.title, scheduledDate: moment.scheduledDate ?? "", scheduledTime: moment.scheduledTime ?? "", cta: moment.cta ?? "", copy: moment.copy ?? "", link: moment.link ?? "", assetNote: moment.assetNote ?? "", assetDeliverableId: moment.assetDeliverableId ?? "" });
  const save = useMutation(trpc.comms.updateMoment.mutationOptions({ onSuccess: async () => { await invalidate(); onOpenChange(false); toast.success("Moment updated"); }, onError: (e) => toast.error(e.message) }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit moment</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          {!moment.isChecklist && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Date</Label><Input type="date" className="tabular" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></div>
              <div className="grid gap-1"><Label>Time</Label><Input type="time" className="tabular" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} /></div>
            </div>
          )}
          <div className="grid gap-1"><Label>CTA</Label><Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} placeholder="Pre-save now." /></div>
          <div className="grid gap-1"><Label>Copy</Label><Textarea rows={3} value={form.copy} onChange={(e) => setForm({ ...form, copy: e.target.value })} placeholder="Caption / post copy" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Link</Label><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://ffm.to/…" /></div>
            <div className="grid gap-1"><Label>Asset</Label>
              <Select value={form.assetDeliverableId || "none"} onValueChange={(v) => setForm({ ...form, assetDeliverableId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Link a deliverable" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{deliverables.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1"><Label>Asset note</Label><Input value={form.assetNote} onChange={(e) => setForm({ ...form, assetNote: e.target.value })} placeholder="e.g. Artist jamming to a 15s snippet" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={save.isPending || !form.title.trim()} onClick={() => save.mutate({ workspace: ws.slug, momentId: moment.id, title: form.title.trim(), scheduledDate: moment.isChecklist ? undefined : form.scheduledDate || null, scheduledTime: moment.isChecklist ? undefined : form.scheduledTime || null, cta: form.cta || null, copy: form.copy || null, link: form.link || null, assetNote: form.assetNote || null, assetDeliverableId: form.assetDeliverableId || null })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({ open, onOpenChange, momentId, parentItemId }: { open: boolean; onOpenChange: (o: boolean) => void; momentId: string; parentItemId: string | null }) {
  const { ws, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const add = useMutation(trpc.comms.addItem.mutationOptions({ onSuccess: async () => { await invalidate(); onOpenChange(false); setTitle(""); }, onError: (e) => toast.error(e.message) }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{parentItemId ? "Add sub-item" : "Add checklist item"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-1"><Label>Item</Label><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pin post to profile" onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) add.mutate({ workspace: ws.slug, momentId, platform, title: title.trim(), parentItemId }); }} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || add.isPending} onClick={() => add.mutate({ workspace: ws.slug, momentId, platform, title: title.trim(), parentItemId })}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMomentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { ws, projectId, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [form, setForm] = useState({ title: "", scheduledDate: "", scheduledTime: "12:00", cta: "", isChecklist: false });
  const add = useMutation(trpc.comms.addMoment.mutationOptions({ onSuccess: async () => { await invalidate(); onOpenChange(false); setForm({ title: "", scheduledDate: "", scheduledTime: "12:00", cta: "", isChecklist: false }); toast.success("Moment added"); }, onError: (e) => toast.error(e.message) }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add rollout moment</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Title</Label><Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Behind-the-song video" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Date</Label><Input type="date" className="tabular" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Time</Label><Input type="time" className="tabular" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} /></div>
          </div>
          <div className="grid gap-1"><Label>CTA</Label><Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.isChecklist} onCheckedChange={(v) => setForm({ ...form, isChecklist: !!v })} />Standing checklist (not dated)</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.title.trim() || add.isPending} onClick={() => add.mutate({ workspace: ws.slug, projectId, title: form.title.trim(), scheduledDate: form.isChecklist ? null : form.scheduledDate || null, scheduledTime: form.isChecklist ? null : form.scheduledTime || null, cta: form.cta || undefined, isChecklist: form.isChecklist })}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
