"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Film, Image as ImageIcon, Link2, Music, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { DELIVERABLE_KINDS, type DeliverableKind } from "@fletcher/core";
import { useProjectData, useInvalidateProject } from "@/lib/hooks/use-project-data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeliverableStatusBadge } from "@/components/fletcher/status-badge";
import { EmptyState } from "@/components/fletcher/empty-state";

export const KIND_ICON: Record<DeliverableKind, React.ComponentType<{ className?: string }>> = { video: Film, image: ImageIcon, audio: Music, document: FileText, link: Link2 };

export function ProjectDeliverablesView() {
  const { data, isLoading, ws, projectId, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DeliverableKind>("video");
  const create = useMutation(trpc.deliverables.create.mutationOptions({ onSuccess: async () => { await invalidate(); setOpen(false); setTitle(""); toast.success("Deliverable added"); }, onError: (e) => toast.error(e.message) }));

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;
  const items = data.deliverables.filter((d) => !d.specKey);
  const taskFor = new Map(data.tasks.filter((t) => t.deliverableId).map((t) => [t.deliverableId!, t]));

  return (
    <div className="fade-in-up">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Videos, artwork, audio and documents the team delivers and reviews. Spec-driven assets live under <Link href={`/w/${ws.slug}/projects/${projectId}/assets`} className="text-brand hover:underline">Assets</Link>.</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus />Deliverable</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Film />} title="No deliverables yet" description="Add a video, artwork or document to start collecting versions and feedback." action={<Button size="sm" onClick={() => setOpen(true)}>Add deliverable</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((d) => {
            const Icon = KIND_ICON[d.kind];
            const task = taskFor.get(d.id);
            const v = d.latestVersion;
            return (
              <Link key={d.id} href={`/w/${ws.slug}/deliverables/${d.id}`} className="surface group flex flex-col gap-3 p-4 transition-shadow hover:shadow-float">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                  <DeliverableStatusBadge status={d.status} />
                </div>
                <div>
                  <div className="truncate text-sm font-semibold">{d.title}</div>
                  <div className="truncate text-2xs text-muted-foreground">{task ? `Task due ${task.dueDate ?? "—"}` : d.kind}</div>
                </div>
                <div className="flex items-center justify-between text-2xs text-muted-foreground">
                  {v ? <span className="tabular">v{v.versionNumber} · {v.sourceType} · {formatDistanceToNowStrict(new Date(v.createdAt), { addSuffix: true })}</span> : <span>No versions yet</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New deliverable</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>Title</Label><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lyric video" /></div>
            <div className="grid gap-1"><Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as DeliverableKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DELIVERABLE_KINDS.map((k) => <SelectItem key={k} value={k}>{k[0]!.toUpperCase() + k.slice(1)}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate({ workspace: ws.slug, projectId, title: title.trim(), kind })}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
