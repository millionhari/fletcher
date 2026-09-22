"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronRight, Copy, Disc3, Film, ListMusic, Lock, Megaphone, Music2, Plus, Send, Shapes, Star, Ticket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_ANCHOR_LABELS, PROJECT_TYPES, PROJECT_TYPE_LABELS, TEMPLATE_KINDS, type ProjectType, type TemplateKind } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/fletcher/page-header";
import { Pill } from "@/components/fletcher/status-badge";

const KIND_BLURB: Record<TemplateKind, string> = {
  timeline: "Dated tasks with roles, durations and checklists, scheduled backward from one anchor date.",
  comms: "Rollout moments — the posts, emails and drops that go out around the release.",
};

type Preset = { kind: TemplateKind; projectType: ProjectType };

const TYPE_ICONS: Record<ProjectType, React.ComponentType<{ className?: string }>> = { single: Music2, album: Disc3, ep: ListMusic, music_video: Film, tour: Ticket, campaign: Megaphone, custom: Shapes };

// A project is built from one template of each kind, so every project type is
// laid out as the same two lanes. `accent` is the only colour difference — the
// lanes are told apart by position and label first.
const LANES: { kind: TemplateKind; title: string; blurb: string; unit: string; icon: React.ComponentType<{ className?: string }>; accent: string }[] = [
  { kind: "timeline", title: "Timeline", blurb: "The work: dated tasks, roles and checklists", unit: "task", icon: CalendarRange, accent: "bg-brand-soft text-brand" },
  { kind: "comms", title: "Comms", blurb: "What goes out publicly: posts, emails and drops", unit: "moment", icon: Send, accent: "bg-chart-5/10 text-chart-5" },
];

function fmtOffset(days: number): string {
  if (days === 0) return "the day";
  const n = Math.abs(days);
  return `${n < 14 ? `${n}d` : `${Math.round(n / 7)}w`} ${days < 0 ? "before" : "after"}`;
}

/** "9w before → 4w after": how far around the anchor date a template reaches. */
function spanLabel(offsets: number[]): string | null {
  if (!offsets.length) return null;
  const min = Math.min(...offsets);
  const max = Math.max(...offsets);
  return min === max ? fmtOffset(min) : `${fmtOffset(min)} → ${fmtOffset(max)}`;
}

export function TemplatesListView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery(trpc.templates.list.queryOptions({ workspace: ws.slug }));
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.templates.list.queryKey() });
  const duplicate = useMutation(trpc.templates.duplicateToWorkspace.mutationOptions({ onSuccess: async (t) => { await invalidate(); toast.success("Copied to your workspace"); router.push(`/w/${ws.slug}/templates/${t.id}`); }, onError: (e) => toast.error(e.message) }));
  const setDefault = useMutation(trpc.templates.setDefault.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("Set as default"); }, onError: (e) => toast.error(e.message) }));
  const [preset, setPreset] = useState<Preset | null>(null);

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Templates"
        description="Every project is built from two templates: a timeline (the work to get done) and a comms plan (what goes out publicly). Each project type has its own pair. System templates carry the industry defaults; duplicate one to tailor it, or build your own."
        actions={<Button size="sm" onClick={() => setPreset({ kind: "timeline", projectType: "single" })}><Plus />New template</Button>}
      />
      {preset && <NewTemplateDialog key={`${preset.kind}-${preset.projectType}`} preset={preset} onClose={() => setPreset(null)} />}
      {q.isLoading || !q.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="stagger space-y-5">
          {/* Column key, said once: the same two lanes repeat in every project type below. */}
          <div className="hidden grid-cols-2 px-px md:grid">
            {LANES.map((lane) => (
              <div key={lane.kind} className="flex items-baseline gap-2 px-4">
                <span className="text-xs font-semibold">{lane.title}</span>
                <span className="truncate text-xs text-muted-foreground">{lane.blurb}</span>
              </div>
            ))}
          </div>
          {PROJECT_TYPES.map((type) => {
            const rows = q.data.filter((t) => t.projectType === type);
            if (!rows.length) return null;
            const TypeIcon = TYPE_ICONS[type];
            return (
              <section key={type} className="surface overflow-hidden">
                <header className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
                  <span className="flex size-6 items-center justify-center rounded-md bg-muted text-foreground"><TypeIcon className="size-3.5" /></span>
                  <h2 className="text-sm font-semibold">{PROJECT_TYPE_LABELS[type]}</h2>
                </header>
                <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
                  {LANES.map((lane) => {
                    const items = rows.filter((t) => t.kind === lane.kind);
                    // Mirrors the wizard: a workspace default wins, otherwise the system template.
                    const inUse = items.find((t) => !t.isSystem && t.isDefault) ?? items.find((t) => t.isSystem) ?? null;
                    return (
                      <div key={lane.kind} className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
                          <span className={cn("flex size-5 items-center justify-center rounded", lane.accent)}><lane.icon className="size-3" /></span>
                          <span className="text-2xs font-semibold uppercase tracking-wider">{lane.title}</span>
                          <Button variant="ghost" size="xs" className="-mr-2 ml-auto shrink-0" onClick={() => setPreset({ kind: lane.kind, projectType: type })}><Plus />New</Button>
                        </div>
                        <div className="flex-1 px-2 pb-2">
                          {items.map((t) => {
                            const def = t.definition as { tasks?: { offsetDays: number }[]; moments?: { offsetDays: number }[] };
                            const entries = (lane.kind === "timeline" ? def.tasks : def.moments) ?? [];
                            const span = spanLabel(entries.map((e) => e.offsetDays));
                            return (
                              <div key={t.id} className="group/row relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    {/* Stretched link: the whole row opens the template, the actions sit above it. */}
                                    <Link href={`/w/${ws.slug}/templates/${t.id}`} className="truncate text-[13px] font-medium after:absolute after:inset-0 after:rounded-lg">{t.name}</Link>
                                    {t.isSystem && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="System template" />}
                                    {t.id === inUse?.id && <Pill tone="success" dot={false} className="shrink-0"><Star className="size-2.5" />Default</Pill>}
                                  </div>
                                  <div className="tabular mt-0.5 truncate text-2xs text-muted-foreground">
                                    {entries.length} {lane.unit}{entries.length === 1 ? "" : "s"}{span && <> · {span}</>}{!t.isSystem && <> · custom</>}
                                  </div>
                                </div>
                                <div className="relative flex shrink-0 items-center gap-0.5 text-muted-foreground">
                                  {!t.isSystem && t.id !== inUse?.id && <Button variant="ghost" size="icon-xs" aria-label={`Make ${t.name} the default`} title="Make default" onClick={() => setDefault.mutate({ workspace: ws.slug, templateId: t.id })}><Star /></Button>}
                                  <Button variant="ghost" size="icon-xs" aria-label={`Duplicate ${t.name}`} title="Duplicate" onClick={() => duplicate.mutate({ workspace: ws.slug, templateId: t.id })}><Copy /></Button>
                                  <ChevronRight className="size-3.5 opacity-40 transition-all group-hover/row:translate-x-0.5 group-hover/row:opacity-100" />
                                </div>
                              </div>
                            );
                          })}
                          {items.length === 0 && (
                            <button type="button" onClick={() => setPreset({ kind: lane.kind, projectType: type })} className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-dashed border-border px-3 py-3 text-left transition-colors hover:border-foreground/30">
                              <span className="text-xs font-medium">No {lane.title.toLowerCase()} template</span>
                              <span className="text-2xs text-muted-foreground">{lane.kind === "timeline" ? "Projects of this type start with no tasks." : "Projects of this type start with no rollout moments."} Create one.</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Mounted only while open (keyed by preset), so it always starts from the lane it was opened from. */
function NewTemplateDialog({ preset, onClose }: { preset: Preset; onClose: () => void }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const [kind, setKind] = useState<TemplateKind>(preset.kind);
  const [projectType, setProjectType] = useState<ProjectType>(preset.projectType);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Tracks whether the anchor label was typed by hand, so switching project
  // type keeps re-deriving the default until the user overrides it.
  const [anchorLabel, setAnchorLabel] = useState<string | null>(null);
  const effectiveAnchor = anchorLabel ?? DEFAULT_ANCHOR_LABELS[projectType];

  const create = useMutation(
    trpc.templates.create.mutationOptions({
      onSuccess: async (t) => {
        await qc.invalidateQueries({ queryKey: trpc.templates.list.queryKey() });
        toast.success(`${t.name} created`, { description: "Add your tasks and save." });
        onClose();
        router.push(`/w/${ws.slug}/templates/${t.id}`);
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const valid = name.trim().length > 0 && (kind === "comms" || effectiveAnchor.trim().length > 0);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>Starts empty. You pick the shape here, then build the tasks or moments in the editor.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Kind</Label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={cn("surface p-3 text-left transition-all hover:shadow-float", kind === k && "ring-2 ring-brand")}>
                  <span className="block text-sm font-semibold">{k === "timeline" ? "Timeline" : "Comms"}</span>
                  <span className="mt-0.5 block text-2xs text-muted-foreground">{KIND_BLURB[k]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-type">Project type</Label>
            <Select value={projectType} onValueChange={(v) => setProjectType(v as ProjectType)}>
              <SelectTrigger id="tpl-type" size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-2xs text-muted-foreground">Projects of this type will offer the template in the new-project wizard.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input id="tpl-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "timeline" ? "e.g. Indie single, no radio" : "e.g. Short-form heavy rollout"} />
          </div>
          {kind === "timeline" && (
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-anchor">Anchor label</Label>
              <Input id="tpl-anchor" value={effectiveAnchor} onChange={(e) => setAnchorLabel(e.target.value)} className="w-56" />
              <p className="text-2xs text-muted-foreground">The one date the project is built around. Every task offset counts from it.</p>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-desc">Description <span className="font-normal text-muted-foreground">· optional</span></Label>
            <Textarea id="tpl-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this template is for, and when to reach for it." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid || create.isPending}
            onClick={() => create.mutate({ workspace: ws.slug, kind, projectType, name: name.trim(), description: description.trim() || null, anchorLabel: kind === "timeline" ? effectiveAnchor.trim() : undefined })}
          >
            {create.isPending ? "Creating…" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
