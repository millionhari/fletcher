"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Copy, Lock, Plus, Star } from "lucide-react";
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
import { PageHeader, SectionHeader } from "@/components/fletcher/page-header";
import { Pill } from "@/components/fletcher/status-badge";

const KIND_BLURB: Record<TemplateKind, string> = {
  timeline: "Dated tasks with roles, durations and checklists, scheduled backward from one anchor date.",
  comms: "Rollout moments — the posts, emails and drops that go out around the release.",
};

export function TemplatesListView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery(trpc.templates.list.queryOptions({ workspace: ws.slug }));
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.templates.list.queryKey() });
  const duplicate = useMutation(trpc.templates.duplicateToWorkspace.mutationOptions({ onSuccess: async (t) => { await invalidate(); toast.success("Copied to your workspace"); router.push(`/w/${ws.slug}/templates/${t.id}`); }, onError: (e) => toast.error(e.message) }));
  const setDefault = useMutation(trpc.templates.setDefault.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("Set as default"); }, onError: (e) => toast.error(e.message) }));
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Templates"
        description="Every project starts from a timeline template (dated tasks) and a comms template (rollout moments). System templates carry the industry defaults; copy one to change offsets, roles or checklists for this artist, or build your own from scratch."
        actions={<Button size="sm" onClick={() => setNewOpen(true)}><Plus />New template</Button>}
      />
      <NewTemplateDialog open={newOpen} onOpenChange={setNewOpen} />
      {q.isLoading || !q.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-8">
          {PROJECT_TYPES.map((type) => {
            const rows = q.data.filter((t) => t.projectType === type);
            if (!rows.length) return null;
            return (
              <section key={type}>
                <SectionHeader title={PROJECT_TYPE_LABELS[type]} count={rows.length} />
                <div className="grid gap-3 md:grid-cols-2">
                  {rows.map((t) => {
                    const def = t.definition as { tasks?: unknown[]; moments?: unknown[] };
                    const count = t.kind === "timeline" ? def.tasks?.length ?? 0 : def.moments?.length ?? 0;
                    return (
                      <div key={t.id} className="surface flex flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/w/${ws.slug}/templates/${t.id}`} className="truncate text-sm font-semibold hover:underline">{t.name}</Link>
                              <Pill tone={t.kind === "timeline" ? "info" : "brand"} dot={false}>{t.kind === "timeline" ? "Timeline" : "Comms"}</Pill>
                              {t.isSystem ? <Pill tone="neutral" dot={false}><Lock className="size-2.5" />System</Pill> : t.isDefault ? <Pill tone="success" dot={false}><Star className="size-2.5" />Default</Pill> : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                          </div>
                          <span className="tabular shrink-0 text-2xs text-muted-foreground">{count} {t.kind === "timeline" ? "tasks" : "moments"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="xs"><Link href={`/w/${ws.slug}/templates/${t.id}`}>{t.isSystem ? "View" : "Edit"}</Link></Button>
                          <Button variant="ghost" size="xs" onClick={() => duplicate.mutate({ workspace: ws.slug, templateId: t.id })}><Copy />Duplicate</Button>
                          {!t.isSystem && !t.isDefault && <Button variant="ghost" size="xs" onClick={() => setDefault.mutate({ workspace: ws.slug, templateId: t.id })}><Star />Make default</Button>}
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

function NewTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const [kind, setKind] = useState<TemplateKind>("timeline");
  const [projectType, setProjectType] = useState<ProjectType>("single");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Tracks whether the anchor label was typed by hand, so switching project
  // type keeps re-deriving the default until the user overrides it.
  const [anchorLabel, setAnchorLabel] = useState<string | null>(null);
  const effectiveAnchor = anchorLabel ?? DEFAULT_ANCHOR_LABELS[projectType];

  const reset = () => { setKind("timeline"); setProjectType("single"); setName(""); setDescription(""); setAnchorLabel(null); };
  const create = useMutation(
    trpc.templates.create.mutationOptions({
      onSuccess: async (t) => {
        await qc.invalidateQueries({ queryKey: trpc.templates.list.queryKey() });
        toast.success(`${t.name} created`, { description: "Add your tasks and save." });
        onOpenChange(false);
        reset();
        router.push(`/w/${ws.slug}/templates/${t.id}`);
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const valid = name.trim().length > 0 && (kind === "comms" || effectiveAnchor.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
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
