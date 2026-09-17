"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MEMBER_ROLES, MEMBER_ROLE_LABELS, PLATFORMS, PLATFORM_LABELS, commsTemplateDefSchema, timelineTemplateDefSchema, type CommsTemplateDef, type TimelineTaskDef, type TimelineTemplateDef, type MemberRole, type Platform } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlatformIcon } from "@/components/fletcher/platform-icon";
import { Pill } from "@/components/fletcher/status-badge";

export function TemplateEditorView({ templateId }: { templateId: string }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery(trpc.templates.get.queryOptions({ workspace: ws.slug, templateId }));
  const save = useMutation(trpc.templates.update.mutationOptions({ onSuccess: async () => { await qc.invalidateQueries({ queryKey: trpc.templates.list.queryKey() }); await qc.invalidateQueries({ queryKey: trpc.templates.get.queryKey({ workspace: ws.slug, templateId }) }); toast.success("Template saved"); }, onError: (e) => toast.error(e.message) }));
  const duplicate = useMutation(trpc.templates.duplicateToWorkspace.mutationOptions({ onSuccess: (t) => { toast.success("Copied to your workspace"); router.push(`/w/${ws.slug}/templates/${t.id}`); }, onError: (e) => toast.error(e.message) }));
  const del = useMutation(trpc.templates.delete.mutationOptions({ onSuccess: () => { toast.success("Template deleted"); router.push(`/w/${ws.slug}/templates`); }, onError: (e) => toast.error(e.message) }));

  if (q.isLoading || !q.data) return <Skeleton className="h-96 rounded-xl" />;
  const t = q.data;
  const readOnly = t.isSystem;

  return (
    <div className="fade-in-up">
      <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href={`/w/${ws.slug}/templates`} className="hover:text-foreground">Templates</Link><ChevronRight className="size-3" /><span className="text-foreground">{t.name}</span>
      </div>
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-xl font-semibold leading-7">{t.name}</h1><Pill tone={t.kind === "timeline" ? "info" : "brand"} dot={false}>{t.kind === "timeline" ? "Timeline" : "Comms"}</Pill>{readOnly && <Pill tone="neutral" dot={false}><Lock className="size-2.5" />System · read-only</Pill>}</div>
          <p className="mt-1 max-w-2xl text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {readOnly ? (
            <Button size="sm" onClick={() => duplicate.mutate({ workspace: ws.slug, templateId })}><Copy />Duplicate to customize</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this template?")) del.mutate({ workspace: ws.slug, templateId }); }}><Trash2 />Delete</Button>
          )}
        </div>
      </div>
      {t.kind === "timeline" ? (
        <TimelineEditor key={t.updatedAt.toString()} initial={timelineTemplateDefSchema.parse(t.definition)} name={t.name} readOnly={readOnly} saving={save.isPending} onSave={(def, name) => save.mutate({ workspace: ws.slug, templateId, definition: def, name })} />
      ) : (
        <CommsEditor key={t.updatedAt.toString()} initial={commsTemplateDefSchema.parse(t.definition) as CommsTemplateDef} name={t.name} readOnly={readOnly} saving={save.isPending} onSave={(def, name) => save.mutate({ workspace: ws.slug, templateId, definition: def, name })} />
      )}
    </div>
  );
}

function TimelineEditor({ initial, name: initialName, readOnly, saving, onSave }: { initial: TimelineTemplateDef; name: string; readOnly: boolean; saving: boolean; onSave: (def: TimelineTemplateDef, name: string) => void }) {
  const [def, setDef] = useState(initial);
  const [name, setName] = useState(initialName);
  const dirty = useMemo(() => JSON.stringify(def) !== JSON.stringify(initial) || name !== initialName, [def, initial, name, initialName]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const setTask = (i: number, patch: Partial<TimelineTaskDef>) => setDef({ ...def, tasks: def.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const addTask = (phase: string) => setDef({ ...def, tasks: [...def.tasks, { key: `task_${Date.now().toString(36)}`, title: "New task", phase, roleKey: "marketing", offsetDays: 0 }] });
  const removeTask = (i: number) => setDef({ ...def, tasks: def.tasks.filter((_, j) => j !== i) });
  const byPhase = def.phases.map((p) => ({ phase: p, rows: def.tasks.map((t, i) => ({ t, i })).filter((x) => x.t.phase === p.key).sort((a, b) => a.t.offsetDays - b.t.offsetDays) }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!readOnly && <Input value={name} onChange={(e) => setName(e.target.value)} className="w-72" />}
          <span className="text-xs text-muted-foreground">Anchor: <span className="font-medium text-foreground">{def.anchorLabel}</span> · offsets in days (negative = before)</span>
        </div>
        {!readOnly && <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(def, name)}>{saving ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>}
      </div>
      <div className="surface overflow-hidden">
        <div className="grid grid-cols-[72px_1fr_160px_70px_70px_90px_32px] items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Offset</span><span>Task</span><span>Role</span><span>Duration</span><span>Snap</span><span>Deliverable</span><span />
        </div>
        {byPhase.map(({ phase, rows }) => (
          <div key={phase.key}>
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{phase.title}</span>
              {!readOnly && <Button variant="ghost" size="xs" onClick={() => addTask(phase.key)}><Plus />Task</Button>}
            </div>
            {rows.map(({ t, i }) => (
              <div key={t.key} className="grid grid-cols-[72px_1fr_160px_70px_70px_90px_32px] items-center gap-2 border-b border-border px-3 py-1 last:border-0">
                <Input type="number" disabled={readOnly} value={t.offsetDays} onChange={(e) => setTask(i, { offsetDays: Number(e.target.value) })} className="tabular h-7 font-mono text-xs" />
                <div className="min-w-0">
                  <Input disabled={readOnly} value={t.title} onChange={(e) => setTask(i, { title: e.target.value })} className="h-7 text-xs" />
                  {t.dependsOn && t.dependsOn.length > 0 && <div className="mt-0.5 truncate px-1 text-2xs text-muted-foreground">after: {t.dependsOn.join(", ")}</div>}
                </div>
                <Select disabled={readOnly} value={t.roleKey} onValueChange={(v) => setTask(i, { roleKey: v as MemberRole })}><SelectTrigger size="sm" className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MEMBER_ROLES.map((r) => <SelectItem key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select>
                <Input type="number" min={0} disabled={readOnly} value={t.durationDays ?? 0} onChange={(e) => setTask(i, { durationDays: Number(e.target.value) || undefined })} className="tabular h-7 font-mono text-xs" />
                <Select disabled={readOnly} value={t.snapTo ?? "none"} onValueChange={(v) => setTask(i, { snapTo: v === "none" ? undefined : (v as TimelineTaskDef["snapTo"]) })}><SelectTrigger size="sm" className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{["mon", "tue", "wed", "thu", "fri"].map((d) => <SelectItem key={d} value={d}>{d[0]!.toUpperCase() + d.slice(1)}</SelectItem>)}</SelectContent></Select>
                <Select disabled={readOnly} value={t.deliverable?.kind ?? "none"} onValueChange={(v) => setTask(i, { deliverable: v === "none" ? undefined : { kind: v as never, specKey: t.deliverable?.specKey } })}><SelectTrigger size="sm" className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{["video", "image", "audio", "document", "link"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
                {!readOnly ? <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => removeTask(i)}><Trash2 /></Button> : <span />}
              </div>
            ))}
          </div>
        ))}
      </div>
      {def.options && def.options.length > 0 && (
        <div className="mt-4 text-xs text-muted-foreground">Options: {def.options.map((o) => o.label).join(", ")} (edited in JSON for now).</div>
      )}
    </div>
  );
}

function CommsEditor({ initial, name: initialName, readOnly, saving, onSave }: { initial: CommsTemplateDef; name: string; readOnly: boolean; saving: boolean; onSave: (def: CommsTemplateDef, name: string) => void }) {
  const [def, setDef] = useState(initial);
  const [name, setName] = useState(initialName);
  const dirty = useMemo(() => JSON.stringify(def) !== JSON.stringify(initial) || name !== initialName, [def, initial, name, initialName]);
  const setMoment = (i: number, patch: Partial<CommsTemplateDef["moments"][number]>) => setDef({ ...def, moments: def.moments.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const addItem = (i: number) => setMoment(i, { items: [...def.moments[i]!.items, { platform: "instagram", title: "New item" }] });
  const setItem = (i: number, k: number, patch: { platform?: Platform; title?: string }) => setMoment(i, { items: def.moments[i]!.items.map((it, j) => (j === k ? { ...it, ...patch } : it)) });
  const removeItem = (i: number, k: number) => setMoment(i, { items: def.moments[i]!.items.filter((_, j) => j !== k) });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!readOnly && <Input value={name} onChange={(e) => setName(e.target.value)} className="w-72" />}
          <span className="text-xs text-muted-foreground">Offsets relative to the release / announce date. Sub-items are edited on the project once created.</span>
        </div>
        <div className="flex gap-2">
          {!readOnly && <Button variant="outline" size="sm" onClick={() => setDef({ ...def, moments: [...def.moments, { key: `m_${Date.now().toString(36)}`, title: "New moment", offsetDays: 0, time: "12:00", items: [] }] })}><Plus />Moment</Button>}
          {!readOnly && <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(def, name)}>{saving ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>}
        </div>
      </div>
      <div className="space-y-3">
        {def.moments.map((m, i) => (
          <div key={m.key} className="surface p-4">
            <div className="grid grid-cols-[80px_90px_1fr_1fr_32px] items-center gap-2">
              <Input type="number" disabled={readOnly} value={m.offsetDays} onChange={(e) => setMoment(i, { offsetDays: Number(e.target.value) })} className="tabular h-7 font-mono text-xs" />
              <Input type="time" disabled={readOnly} value={m.time ?? ""} onChange={(e) => setMoment(i, { time: e.target.value || undefined })} className="tabular h-7 text-xs" />
              <Input disabled={readOnly} value={m.title} onChange={(e) => setMoment(i, { title: e.target.value })} className="h-7 text-xs font-medium" />
              <Input disabled={readOnly} value={m.cta ?? ""} placeholder="CTA" onChange={(e) => setMoment(i, { cta: e.target.value || undefined })} className="h-7 text-xs" />
              {!readOnly ? <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => setDef({ ...def, moments: def.moments.filter((_, j) => j !== i) })}><Trash2 /></Button> : <span />}
            </div>
            <div className="mt-3 grid gap-1 md:grid-cols-2">
              {m.items.map((it, k) => (
                <div key={k} className={cn("flex items-center gap-2 rounded-md px-1 py-0.5", !readOnly && "hover:bg-muted/50")}>
                  {readOnly ? (
                    <><PlatformIcon platform={it.platform} size="xs" /><span className="text-xs">{it.title}</span>{it.children && it.children.length > 0 && <span className="text-2xs text-muted-foreground">+{it.children.length}</span>}</>
                  ) : (
                    <>
                      <Select value={it.platform} onValueChange={(v) => setItem(i, k, { platform: v as Platform })}><SelectTrigger size="sm" className="h-6 w-28 text-2xs"><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}</SelectContent></Select>
                      <Input value={it.title} onChange={(e) => setItem(i, k, { title: e.target.value })} className="h-6 text-xs" />
                      <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => removeItem(i, k)}><Trash2 /></Button>
                    </>
                  )}
                </div>
              ))}
              {!readOnly && <Button variant="ghost" size="xs" className="justify-start" onClick={() => addItem(i)}><Plus />Item</Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
