"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, ChevronRight, Clock, CornerDownRight, ExternalLink, MessageSquare, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@/lib/format";
import { DELIVERABLE_STATUS_LABELS, formatTimestamp, parseVideoLink, type DeliverableStatus } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeliverableStatusBadge, SpecStatusPill } from "@/components/fletcher/status-badge";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { VideoPlayer, type PlayerHandle } from "@/components/fletcher/review/video-player";
import { ScrubBar } from "@/components/fletcher/review/scrub-bar";
import { UploadDropzone, type UploadResult } from "@/components/fletcher/upload-dropzone";

export function ReviewView({ deliverableId }: { deliverableId: string }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(trpc.deliverables.get.queryOptions({ workspace: ws.slug, deliverableId }));
  const [versionId, setVersionId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const versions = q.data?.versions ?? [];
  const active = versions.find((v) => v.id === versionId) ?? versions[0] ?? null;

  const invalidate = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: trpc.deliverables.get.queryKey({ workspace: ws.slug, deliverableId }) });
    await qc.invalidateQueries({ queryKey: trpc.projects.get.queryKey() });
    await qc.invalidateQueries({ queryKey: trpc.dashboard.overview.queryKey() });
  }, [qc, trpc, ws.slug, deliverableId]);

  const setStatus = useMutation(trpc.deliverables.setStatus.mutationOptions({ onSuccess: async (d) => { await invalidate(); toast.success(`Marked ${DELIVERABLE_STATUS_LABELS[d.status].toLowerCase()}`); }, onError: (e) => toast.error(e.message) }));
  const deleteVersion = useMutation(trpc.deliverables.deleteVersion.mutationOptions({ onSuccess: async () => { setVersionId(null); await invalidate(); toast.success("Version removed"); }, onError: (e) => toast.error(e.message) }));

  if (q.isLoading || !q.data) return <div className="grid grid-cols-[1fr_380px] gap-6"><Skeleton className="aspect-video rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>;
  const { deliverable, project, task, spec } = q.data;
  const isVideo = deliverable.kind === "video" || (active?.mimeType?.startsWith("video/") ?? false);
  const isImage = deliverable.kind === "image" || (active?.mimeType?.startsWith("image/") ?? false);

  return (
    <div className="fade-in-up">
      <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href={`/w/${ws.slug}/projects`} className="hover:text-foreground">Projects</Link>
        {project && (<><ChevronRight className="size-3" /><Link href={`/w/${ws.slug}/projects/${project.id}/deliverables`} className="hover:text-foreground">{project.name}</Link></>)}
        <ChevronRight className="size-3" /><span className="text-foreground">{deliverable.title}</span>
      </div>
      <div className="mb-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold leading-7">{deliverable.title}</h1>
            <DeliverableStatusBadge status={deliverable.status} />
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{deliverable.kind}</span>
            {task && (<><span>·</span><span>Task due {task.dueDate ?? "—"}</span></>)}
            {spec && (<><span>·</span><span>Spec: {spec.label}</span></>)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}><Plus />New version</Button>
          <StatusMenu status={deliverable.status} pending={setStatus.isPending} onChange={(s) => setStatus.mutate({ workspace: ws.slug, deliverableId, status: s })} />
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="surface flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Upload className="size-6 text-muted-foreground" />
          <div className="text-sm font-medium">No versions yet</div>
          <p className="max-w-sm text-xs text-muted-foreground">Paste a YouTube or Vimeo link, or upload a file. Each version keeps its own comment thread.</p>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus />Add first version</Button>
        </div>
      ) : (
        <div>
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3 xl:mr-[424px]">
              <Tabs value={active?.id} onValueChange={setVersionId}>
                <TabsList>
                  {[...versions].reverse().map((v) => <TabsTrigger key={v.id} value={v.id}>v{v.versionNumber}</TabsTrigger>)}
                </TabsList>
              </Tabs>
              {active && (
                <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                  <span className="capitalize">{active.sourceType}</span>
                  {active.bytes ? <span>· {fmtBytes(active.bytes)}</span> : null}
                  {active.width && active.height ? <span className="tabular">· {active.width}×{active.height}</span> : null}
                  {active.specCheck && <SpecStatusPill status={active.specCheck.status} />}
                  {active.publicUrl && <a href={active.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><ExternalLink className="size-3" />Open</a>}
                  <Button variant="ghost" size="icon-xs" aria-label="Delete version" onClick={() => { if (confirm(`Delete v${active.versionNumber}?`)) deleteVersion.mutate({ workspace: ws.slug, versionId: active.id }); }}><Trash2 /></Button>
                </div>
              )}
            </div>
            {active && (isVideo && active.sourceType !== "upload" || (active.mimeType?.startsWith("video/") ?? false) || (active.sourceType === "url" && isVideo)) ? (
              <VersionReview key={active.id} version={active} deliverableId={deliverableId} invalidate={invalidate} />
            ) : active && isImage ? (
              <ImageReview key={active.id} version={active} deliverableId={deliverableId} invalidate={invalidate} />
            ) : active ? (
              <FileReview key={active.id} version={active} deliverableId={deliverableId} invalidate={invalidate} />
            ) : null}
          </div>
        </div>
      )}
      <AddVersionDialog open={addOpen} onOpenChange={setAddOpen} deliverableId={deliverableId} kind={deliverable.kind} onDone={async (v) => { await invalidate(); setVersionId(v.id); }} />
    </div>
  );
}


function StatusMenu({ status, onChange, pending }: { status: DeliverableStatus; onChange: (s: DeliverableStatus) => void; pending: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={pending} variant={status === "approved" ? "secondary" : "default"}>{status === "approved" ? <><CheckCircle2 />Approved</> : <><Check />Approve…</>}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange("approved")}><CheckCircle2 className="text-success" />Approve</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("changes_requested")}><RotateCcw className="text-warning" />Request changes</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("in_review")}><Clock className="text-brand" />Back to in review</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("draft")}>Mark as draft</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Player + scrub bar + comment thread for a video version. */
function VersionReview({ version, deliverableId, invalidate }: { version: any; deliverableId: string; invalidate: () => Promise<void> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const playerRef = useRef<PlayerHandle>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(version.durationSeconds ?? 0);
  const comments = useQuery(trpc.comments.listByVersion.queryOptions({ workspace: ws.slug, versionId: version.id }));
  const list = comments.data ?? [];
  const markers = useMemo(() => list.filter((c) => c.timestampSeconds != null && !c.parentCommentId).map((c) => ({ id: c.id, seconds: c.timestampSeconds!, label: c.body, resolved: !!c.resolvedAt, authorName: c.authorName })), [list]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const seek = async (s: number) => { await playerRef.current?.seekTo(s); setCurrent(s); };

  useEffect(() => {
    const near = markers.filter((m) => Math.abs(m.seconds - current) < 1.5)[0];
    setActiveId(near?.id ?? null);
  }, [current, markers]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <VideoPlayer ref={playerRef} sourceType={version.sourceType} url={version.publicUrl ?? version.url} externalId={version.externalId} onTime={setCurrent} onDuration={(d) => setDuration(d)} />
        <ScrubBar duration={duration} current={current} markers={markers} onSeek={seek} activeId={activeId} />
        {version.note && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{version.uploaderName ?? "Uploader"}:</span> {version.note}</p>}
      </div>
      <CommentPanel versionId={version.id} comments={list} activeId={activeId} onSeek={seek} getTime={() => playerRef.current?.getCurrentTime() ?? Promise.resolve(current)} pause={() => playerRef.current?.pause()} invalidate={invalidate} timeCoded />
    </div>
  );
}

function ImageReview({ version, deliverableId, invalidate }: { version: any; deliverableId: string; invalidate: () => Promise<void> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const comments = useQuery(trpc.comments.listByVersion.queryOptions({ workspace: ws.slug, versionId: version.id }));
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="surface flex min-h-[320px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-[size:16px_16px] p-6">
        {version.publicUrl ? <img src={version.publicUrl} alt={version.fileName ?? "asset"} className="max-h-[70vh] max-w-full rounded-lg shadow-float" /> : <span className="text-xs text-muted-foreground">No preview</span>}
      </div>
      <CommentPanel versionId={version.id} comments={comments.data ?? []} activeId={null} onSeek={() => {}} getTime={() => Promise.resolve(0)} pause={() => {}} invalidate={invalidate} timeCoded={false} />
    </div>
  );
}

function FileReview({ version, deliverableId, invalidate }: { version: any; deliverableId: string; invalidate: () => Promise<void> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const comments = useQuery(trpc.comments.listByVersion.queryOptions({ workspace: ws.slug, versionId: version.id }));
  const href = version.publicUrl ?? version.url;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="surface p-6">
        <div className="text-sm font-medium">{version.fileName ?? version.url}</div>
        <div className="mt-1 text-xs text-muted-foreground">{version.mimeType ?? version.sourceType} {version.bytes ? `· ${fmtBytes(version.bytes)}` : ""}</div>
        {href && <Button asChild size="sm" variant="outline" className="mt-4"><a href={href} target="_blank" rel="noreferrer"><ExternalLink />Open</a></Button>}
        {version.mimeType?.startsWith("audio/") && href && <audio controls src={href} className="mt-4 w-full" />}
      </div>
      <CommentPanel versionId={version.id} comments={comments.data ?? []} activeId={null} onSeek={() => {}} getTime={() => Promise.resolve(0)} pause={() => {}} invalidate={invalidate} timeCoded={false} />
    </div>
  );
}

type CommentRow = { id: string; body: string; timestampSeconds: number | null; parentCommentId: string | null; resolvedAt: Date | null; createdAt: Date; authorName: string | null; authorRole: string | null };

function CommentPanel({ versionId, comments, activeId, onSeek, getTime, pause, invalidate, timeCoded }: { versionId: string; comments: CommentRow[]; activeId: string | null; onSeek: (s: number) => void; getTime: () => Promise<number>; pause: () => void; invalidate: () => Promise<void>; timeCoded: boolean }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(timeCoded);
  const [pinned, setPinned] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(true);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: trpc.comments.listByVersion.queryKey({ workspace: ws.slug, versionId }) }); await invalidate(); };
  const add = useMutation(trpc.comments.add.mutationOptions({ onSuccess: async () => { setBody(""); setPinned(null); setReplyTo(null); await refresh(); }, onError: (e) => toast.error(e.message) }));
  const resolve = useMutation(trpc.comments.resolve.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(e.message) }));
  const del = useMutation(trpc.comments.delete.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(e.message) }));

  const roots = comments.filter((c) => !c.parentCommentId).filter((c) => showResolved || !c.resolvedAt).sort((a, b) => (a.timestampSeconds ?? Infinity) - (b.timestampSeconds ?? Infinity) || +new Date(a.createdAt) - +new Date(b.createdAt));
  const replies = (id: string) => comments.filter((c) => c.parentCommentId === id);
  const openCount = comments.filter((c) => !c.parentCommentId && !c.resolvedAt).length;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onFocus = async () => {
    if (!timeCoded || !pin || replyTo) return;
    const t = Math.floor(await getTime());
    setPinned(t);
    pause();
    // The YouTube / Vimeo iframe APIs pull keyboard focus into the iframe when
    // pausing; hand it straight back so typing lands in the textarea.
    requestAnimationFrame(() => textareaRef.current?.focus());
    setTimeout(() => textareaRef.current?.focus(), 150);
  };
  const submit = () => {
    if (!body.trim()) return;
    add.mutate({ workspace: ws.slug, versionId, body: body.trim(), timestampSeconds: replyTo ? null : pin && pinned != null ? pinned : null, parentCommentId: replyTo });
  };

  return (
    <aside className="surface flex max-h-[calc(100vh-140px)] flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold"><MessageSquare className="size-3.5" />Comments <span className="tabular rounded-md bg-muted px-1.5 text-2xs font-medium text-muted-foreground">{openCount} open</span></div>
        <label className="flex items-center gap-1.5 text-2xs text-muted-foreground"><Switch checked={showResolved} onCheckedChange={setShowResolved} className="scale-75" />Resolved</label>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {roots.length === 0 && <p className="px-4 py-8 text-center text-xs text-muted-foreground">No comments yet. {timeCoded ? "Pause where you want to leave a note and start typing." : "Leave the first note."}</p>}
        {roots.map((c) => (
          <div key={c.id} id={`c-${c.id}`} className={cn("group border-b border-border px-4 py-3 transition-colors", activeId === c.id && "bg-brand-soft/60", c.resolvedAt && "opacity-70")}>
            <div className="flex items-start gap-2.5">
              <MemberAvatar name={c.authorName} size="sm" showTooltip={false} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold">{c.authorName ?? "Someone"}</span>
                  {c.timestampSeconds != null && (
                    <button onClick={() => onSeek(c.timestampSeconds!)} className="rounded bg-foreground px-1.5 font-mono text-[10px] font-semibold text-background hover:bg-brand">{formatTimestamp(c.timestampSeconds)}</button>
                  )}
                  <span className="ml-auto shrink-0 text-2xs text-muted-foreground">{formatDistanceToNowStrict(new Date(c.createdAt), { addSuffix: true })}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-5">{c.body}</p>
                <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button variant="ghost" size="xs" onClick={() => { setReplyTo(c.id); setPinned(null); }}><CornerDownRight />Reply</Button>
                  <Button variant="ghost" size="xs" onClick={() => resolve.mutate({ workspace: ws.slug, commentId: c.id, resolved: !c.resolvedAt })}>{c.resolvedAt ? <><RotateCcw />Reopen</> : <><Check />Resolve</>}</Button>
                  <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => del.mutate({ workspace: ws.slug, commentId: c.id })}><Trash2 /></Button>
                </div>
                {replies(c.id).map((r) => (
                  <div key={r.id} className="mt-2 flex items-start gap-2 border-l-2 border-border pl-2.5">
                    <MemberAvatar name={r.authorName} size="xs" showTooltip={false} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="text-2xs font-semibold">{r.authorName ?? "Someone"}</span><span className="text-2xs text-muted-foreground">{formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true })}</span></div>
                      <p className="text-xs leading-4">{r.body}</p>
                    </div>
                  </div>
                ))}
                {c.resolvedAt && <div className="mt-1.5 flex items-center gap-1 text-2xs text-success"><CheckCircle2 className="size-3" />Resolved</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-2 py-1 text-2xs"><span>Replying to {comments.find((c) => c.id === replyTo)?.authorName ?? "comment"}</span><button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">Cancel</button></div>
        )}
        <Textarea ref={textareaRef} value={body} onChange={(e) => setBody(e.target.value)} onFocus={onFocus} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }} placeholder={timeCoded ? "Leave a note at the current time…" : "Leave a note…"} rows={3} className="resize-none text-[13px]" />
        <div className="mt-2 flex items-center justify-between">
          {timeCoded && !replyTo ? (
            <label className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Switch checked={pin} onCheckedChange={(v) => { setPin(v); if (!v) setPinned(null); }} className="scale-75" />
              {pin ? <span>Pin at <span className="rounded bg-foreground px-1 font-mono text-[10px] font-semibold text-background">{formatTimestamp(pinned ?? 0)}</span></span> : "General note"}
            </label>
          ) : <span />}
          <Button size="sm" disabled={!body.trim() || add.isPending} onClick={submit}>{replyTo ? "Reply" : "Comment"} <span className="ml-1 font-mono text-[10px] opacity-60">⌘↵</span></Button>
        </div>
      </div>
    </aside>
  );
}

function AddVersionDialog({ open, onOpenChange, deliverableId, kind, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; deliverableId: string; kind: string; onDone: (v: { id: string }) => Promise<void> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const [mode, setMode] = useState<"link" | "upload">(kind === "video" ? "link" : "upload");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const add = useMutation(trpc.deliverables.addVersion.mutationOptions({ onSuccess: async (v) => { await onDone(v); onOpenChange(false); setLink(""); setNote(""); setUpload(null); toast.success(`v${v.versionNumber} added`); }, onError: (e) => toast.error(e.message) }));
  const parsed = link ? parseVideoLink(link) : null;
  const canSubmit = mode === "link" ? /^https?:\/\//.test(link) : !!upload;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New version</DialogTitle>
          <DialogDescription>Each version keeps its own comment thread. The deliverable moves to in review.</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "link" | "upload")}>
          <TabsList><TabsTrigger value="link">Paste link</TabsTrigger><TabsTrigger value="upload">Upload file</TabsTrigger></TabsList>
        </Tabs>
        {mode === "link" ? (
          <div className="grid gap-1.5">
            <Label>YouTube, Vimeo or direct file URL</Label>
            <Input autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/… or https://vimeo.com/…" />
            {parsed && <p className="text-2xs text-muted-foreground">Detected: <span className="font-medium capitalize text-foreground">{parsed.source}</span>{parsed.externalId ? ` · ${parsed.externalId}` : ""}</p>}
          </div>
        ) : (
          <UploadDropzone folder={`deliverables/${deliverableId}`} accept={kind === "video" ? "video/*" : kind === "image" ? "image/*" : kind === "audio" ? "audio/*" : undefined} onUploaded={setUpload} value={upload} />
        )}
        <div className="grid gap-1.5">
          <Label>Note (optional)</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed in this cut?" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit || add.isPending} onClick={() => add.mutate({ workspace: ws.slug, deliverableId, note: note || undefined, link: mode === "link" ? link.trim() : undefined, upload: mode === "upload" && upload ? { storageKey: upload.storageKey, fileName: upload.fileName, mimeType: upload.mimeType, bytes: upload.bytes, width: upload.width, height: upload.height, durationSeconds: upload.durationSeconds } : undefined })}>{add.isPending ? "Adding…" : "Add version"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
