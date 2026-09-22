"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Film, Image as ImageIcon, Link2, Music, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@/lib/format";
import { DELIVERABLE_KINDS, type DeliverableKind } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeliverableStatusBadge } from "@/components/fletcher/status-badge";
import { UploadDropzone, type UploadResult } from "@/components/fletcher/upload-dropzone";
import { CloudSourceButtons } from "@/components/fletcher/cloud/cloud-source-buttons";
import { ImportProgress, type FileState } from "@/components/fletcher/cloud/import-progress";
import { LinkProviderIcon } from "@/components/fletcher/cloud/link-provider-icon";
import { detectLinkProvider, LINK_PROVIDER_LABELS } from "@fletcher/core";

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = { video: Film, image: ImageIcon, audio: Music, document: FileText, link: Link2 };

export type Attachment = {
  id: string;
  kind: "deliverable" | "link" | "file";
  url: string | null;
  title: string | null;
  fileName: string | null;
  mimeType: string | null;
  bytes: number | null;
  publicUrl: string | null;
  addedByName: string | null;
  file?: FileState;
  deliverable: { id: string; title: string; kind: string; status: "draft" | "in_review" | "changes_requested" | "approved"; specKey: string | null; latestVersion: { versionNumber: number; sourceType: string; publicUrl: string | null; mimeType: string | null } | null } | null;
};

export function TaskAttachments({ taskId, projectId, attachments, onChanged }: { taskId: string; projectId: string; attachments: Attachment[]; onChanged: () => Promise<unknown> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const remove = useMutation(trpc.taskDetail.removeAttachment.mutationOptions({ onSuccess: onChanged, onError: (e) => toast.error(e.message) }));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Paperclip className="size-3.5" />Attachments {attachments.length > 0 && <span className="tabular rounded-md bg-muted px-1.5 py-px text-2xs font-medium">{attachments.length}</span>}</span>
        <AttachPopover taskId={taskId} projectId={projectId} onChanged={onChanged} attachedDeliverableIds={attachments.map((a) => a.deliverable?.id).filter((x): x is string => !!x)} />
      </div>
      {attachments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">Attach the deliverable under review, a Google Doc, the presave link, or upload a file.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {attachments.map((a) => <AttachmentCard key={a.id} a={a} wsSlug={ws.slug} onRemove={() => remove.mutate({ workspace: ws.slug, attachmentId: a.id })} />)}
        </div>
      )}
    </div>
  );
}

function AttachmentCard({ a, wsSlug, onRemove }: { a: Attachment; wsSlug: string; onRemove: () => void }) {
  const d = a.deliverable;
  if (a.file && a.file.status !== "ready") return <ImportProgress file={a.file} fileName={a.fileName ?? a.title} compact onDelete={onRemove} />;
  const provider = !d && a.kind === "link" && a.url ? detectLinkProvider(a.url) : null;
  const Icon = d ? KIND_ICON[d.kind] ?? FileText : a.kind === "link" ? Link2 : a.mimeType?.startsWith("image/") ? ImageIcon : FileText;
  const thumb = d?.latestVersion?.mimeType?.startsWith("image/") ? d.latestVersion.publicUrl : a.mimeType?.startsWith("image/") ? a.publicUrl : null;
  const href = d ? `/w/${wsSlug}/deliverables/${d.id}` : a.publicUrl ?? a.url ?? "#";
  const external = !d;
  const Wrapper = external ? "a" : Link;
  return (
    <div className="surface group relative flex items-center gap-3 p-2.5">
      <Wrapper href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className="flex min-w-0 flex-1 items-center gap-3">
        {thumb ? <img src={thumb} alt="" className="size-10 shrink-0 rounded-md object-cover" /> : provider ? <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted"><LinkProviderIcon provider={provider} url={a.url!} className="size-5" /></span> : <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{d?.title ?? a.title ?? a.fileName ?? a.url}</span>
          <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            {d ? (<><DeliverableStatusBadge status={d.status} />{d.latestVersion ? <span className="tabular">v{d.latestVersion.versionNumber} · {d.latestVersion.sourceType}</span> : <span>no versions</span>}</>) : a.kind === "link" ? <span className="truncate">{provider ? `${LINK_PROVIDER_LABELS[provider]} · ` : ""}{a.url?.replace(/^https?:\/\/(www\.)?/, "")}</span> : <span>{fmtBytes(a.bytes)}{a.mimeType ? ` · ${a.mimeType.split("/")[1]}` : ""}</span>}
          </span>
        </span>
        {external && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />}
      </Wrapper>
      <Button variant="ghost" size="icon-xs" aria-label="Remove attachment" className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100" onClick={onRemove}><Trash2 /></Button>
    </div>
  );
}

function AttachPopover({ taskId, projectId, onChanged, attachedDeliverableIds }: { taskId: string; projectId: string; onChanged: () => Promise<unknown>; attachedDeliverableIds: string[] }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"deliverables" | "link" | "upload" | "new">("deliverables");
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<DeliverableKind>("document");
  const candidates = useQuery({ ...trpc.taskDetail.candidates.queryOptions({ workspace: ws.slug, projectId }), enabled: open });
  const done = async () => { await onChanged(); setOpen(false); setUrl(""); setTitle(""); setUpload(null); setNewTitle(""); };
  const attachDeliverable = useMutation(trpc.taskDetail.attachDeliverable.mutationOptions({ onSuccess: done, onError: (e) => toast.error(e.message) }));
  const attachLink = useMutation(trpc.taskDetail.attachLink.mutationOptions({ onSuccess: done, onError: (e) => toast.error(e.message) }));
  const attachFile = useMutation(trpc.taskDetail.attachFile.mutationOptions({ onSuccess: done, onError: (e) => toast.error(e.message) }));
  const importPick = useMutation(trpc.imports.fromProvider.mutationOptions({ onSuccess: async () => { await done(); toast.success("Copying the file in…"); }, onError: (e) => toast.error(e.message) }));
  const createNew = useMutation(trpc.taskDetail.createAndAttachDeliverable.mutationOptions({ onSuccess: done, onError: (e) => toast.error(e.message) }));
  const list = (candidates.data ?? []).filter((c) => !attachedDeliverableIds.includes(c.id)).filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(list.map((c) => c.group))];

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline" size="xs"><Plus />Attach</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="mb-3 w-full">
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "deliverables" && (
          <div>
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deliverables and assets…" className="mb-2 h-8" />
            <div className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto">
              {groups.map((g) => (
                <div key={g}>
                  <div className="px-1 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
                  {list.filter((c) => c.group === g).map((c) => {
                    const Icon = KIND_ICON[c.kind] ?? FileText;
                    return (
                      <button key={c.id} onClick={() => attachDeliverable.mutate({ workspace: ws.slug, taskId, deliverableId: c.id })} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs hover:bg-muted">
                        <Icon className="size-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{c.title}</span><DeliverableStatusBadge status={c.status} />
                      </button>
                    );
                  })}
                </div>
              ))}
              {list.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground">{candidates.isLoading ? "Loading…" : "Nothing left to attach."}</p>}
            </div>
          </div>
        )}
        {tab === "link" && (
          <div className="grid gap-2">
            <div className="grid gap-1"><Label className="text-xs">URL</Label><Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/…" /></div>
            <div className="grid gap-1"><Label className="text-xs">Title (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Label copy doc" /></div>
            <Button size="sm" disabled={!/^https?:\/\/.+/.test(url) || attachLink.isPending} onClick={() => attachLink.mutate({ workspace: ws.slug, taskId, url: url.trim(), title: title || undefined })}>Attach link</Button>
          </div>
        )}
        {tab === "upload" && (
          <div className="grid gap-2">
            <UploadDropzone folder={`tasks/${taskId}`} onUploaded={setUpload} value={upload} compact />
            <CloudSourceButtons disabled={importPick.isPending} onPick={(p) => importPick.mutate({ workspace: ws.slug, target: { taskId }, provider: p.provider, file: { id: p.id, link: p.link, name: p.name, mimeType: p.mimeType, bytes: p.bytes } })} />
            <Button size="sm" disabled={!upload || attachFile.isPending} onClick={() => upload && attachFile.mutate({ workspace: ws.slug, taskId, upload: { fileId: upload.fileId } })}>Attach file</Button>
          </div>
        )}
        {tab === "new" && (
          <div className="grid gap-2">
            <p className="text-2xs text-muted-foreground">Creates a deliverable on this project (with its own versions and review) and attaches it.</p>
            <div className="grid gap-1"><Label className="text-xs">Title</Label><Input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Label copy PDF" /></div>
            <div className="grid gap-1"><Label className="text-xs">Kind</Label>
              <Select value={newKind} onValueChange={(v) => setNewKind(v as DeliverableKind)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{DELIVERABLE_KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button size="sm" disabled={!newTitle.trim() || createNew.isPending} onClick={() => createNew.mutate({ workspace: ws.slug, taskId, title: newTitle.trim(), kind: newKind })}>Create & attach</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

