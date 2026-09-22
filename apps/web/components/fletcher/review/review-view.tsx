"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, ChevronRight, Clock, CornerDownRight, ExternalLink, MessageSquare, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@/lib/format";
import { anchorDisplayColor, anchorPage, DELIVERABLE_STATUS_LABELS, formatTimestamp, parseVideoLink, type CommentAnchor, type DeliverableKind, type DeliverableStatus } from "@fletcher/core";
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
import { CloudSourceButtons } from "@/components/fletcher/cloud/cloud-source-buttons";
import { ImportProgress } from "@/components/fletcher/cloud/import-progress";
import type { CloudPick } from "@/components/fletcher/cloud/pickers";
import { CommentThread, readAnchor } from "@/components/fletcher/comment-thread";
import type { AnnotatedViewerHandle, AnnotationBox } from "@/components/fletcher/review/annotation-surface";
import { BackButton } from "@/components/fletcher/back-button";

/**
 * Wording for adding a version, per deliverable kind. A video asks for a YouTube
 * link; a treatment asks for a PDF. Keeping them in one table stops the empty
 * state and the dialog drifting apart.
 */
const KIND_COPY: Record<DeliverableKind, {
  empty: string;
  linkLabel: string;
  linkPlaceholder: string;
  notePlaceholder: string;
  uploadHint: string;
  accept?: string;
  defaultMode: "link" | "upload";
}> = {
  video: {
    empty: "Paste a YouTube or Vimeo link, or upload a cut. Each version keeps its own comment thread, with notes pinned to a timecode.",
    linkLabel: "YouTube, Vimeo or direct video URL",
    linkPlaceholder: "https://youtu.be/… or https://vimeo.com/…",
    notePlaceholder: "What changed in this cut?",
    uploadHint: "MP4 or MOV. Duration and dimensions are read from the file.",
    accept: "video/*",
    defaultMode: "link",
  },
  image: {
    empty: "Upload a JPG, PNG or GIF, or paste a direct link. Each version keeps its own comment thread, with notes pinned to a region of the image.",
    linkLabel: "Direct image URL",
    linkPlaceholder: "https://…/artwork.png",
    notePlaceholder: "What changed in this version?",
    uploadHint: "JPG, PNG, GIF or WebP. Dimensions are read from the file.",
    accept: "image/*",
    defaultMode: "upload",
  },
  document: {
    empty: "Upload a PDF, or paste a link to a Google Doc. PDFs open in the viewer, with notes pinned to a region of the page.",
    linkLabel: "Google Doc, Notion or direct PDF URL",
    linkPlaceholder: "https://docs.google.com/… or https://…/treatment.pdf",
    notePlaceholder: "What changed in this draft?",
    uploadHint: "PDF opens in the annotating viewer; other formats get a download link.",
    defaultMode: "upload",
  },
  audio: {
    empty: "Upload a WAV or MP3, or paste a direct link. Each version keeps its own comment thread.",
    linkLabel: "Direct audio URL",
    linkPlaceholder: "https://…/master.wav",
    notePlaceholder: "What changed in this mix?",
    uploadHint: "WAV or MP3, played back inline.",
    accept: "audio/*",
    defaultMode: "upload",
  },
  link: {
    empty: "Paste the URL you want tracked and reviewed. Each version keeps its own comment thread.",
    linkLabel: "URL",
    linkPlaceholder: "https://…",
    notePlaceholder: "What changed?",
    uploadHint: "Any file you want versioned alongside the link.",
    defaultMode: "link",
  },
};

/** pdfjs touches `window` and DOMMatrix at import time, so never render it on the server. */
const PdfViewer = dynamic(() => import("@/components/fletcher/review/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <Skeleton className="h-[520px] rounded-xl" />,
});

const ImageViewer = dynamic(() => import("@/components/fletcher/review/image-viewer").then((m) => m.ImageViewer), {
  ssr: false,
  loading: () => <Skeleton className="h-[520px] rounded-xl" />,
});

/**
 * Shared by the PDF and image reviewers: turn comment rows into drawable boxes.
 * Boxes are numbered in reading order (page, then down the page) and the rail
 * shows the same number, so a marker on the document and a card in the list
 * refer to each other by something you can actually say out loud.
 */
function useAnnotationBoxes(list: { id: string; anchor?: unknown; parentCommentId: string | null; resolvedAt: Date | null }[]): AnnotationBox[] {
  return useMemo(
    () =>
      list
        .filter((c) => !c.parentCommentId)
        .flatMap((c) => {
          const a = readAnchor(c.anchor);
          return a ? [{ id: c.id, page: anchorPage(a), rect: a.rect, color: anchorDisplayColor(c.id, a), resolved: !!c.resolvedAt, strokes: a.strokes }] : [];
        })
        .sort((x, y) => x.page - y.page || x.rect.y - y.rect.y)
        .map((b, i) => ({ ...b, index: i + 1 })),
    [list],
  );
}

/** Per-comment "hide this markup" state; the surface only ever sees the visible boxes. */
function useHiddenBoxes(boxes: AnnotationBox[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visible = useMemo(() => boxes.filter((b) => !hidden.has(b.id)), [boxes, hidden]);
  return { hidden, toggle, visible };
}

export function ReviewView({ deliverableId }: { deliverableId: string }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  // While a version is still being copied in, poll so the progress bar moves without a reload.
  const q = useQuery({ ...trpc.deliverables.get.queryOptions({ workspace: ws.slug, deliverableId }), refetchInterval: (query) => (query.state.data?.versions.some((v) => v.file?.status === "importing") ? 2000 : false) });
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
  const retryImport = useMutation(trpc.imports.retry.mutationOptions({ onSuccess: () => invalidate(), onError: (e) => toast.error(e.message) }));

  if (q.isLoading || !q.data) return <div className="grid grid-cols-[1fr_380px] gap-6"><Skeleton className="aspect-video rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>;
  const { deliverable, project, task, spec } = q.data;
  const isVideo = deliverable.kind === "video" || (active?.mimeType?.startsWith("video/") ?? false);
  const isImage = deliverable.kind === "image" || (active?.mimeType?.startsWith("image/") ?? false);
  const isPdf = (active?.mimeType === "application/pdf") || (active?.fileName?.toLowerCase().endsWith(".pdf") ?? false);

  return (
    <div className="fade-in-up">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <BackButton fallback={project ? `/w/${ws.slug}/projects/${project.id}/deliverables` : `/w/${ws.slug}/projects`} />
        <span className="h-4 w-px bg-border" />
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
          <p className="max-w-sm text-xs text-muted-foreground">{KIND_COPY[deliverable.kind].empty}</p>
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
            {active && active.file && active.file.status !== "ready" ? (
              <ImportProgress
                file={active.file}
                fileName={active.fileName}
                origin={null}
                onRetry={() => active.fileId && retryImport.mutate({ workspace: ws.slug, fileId: active.fileId })}
                onDelete={() => deleteVersion.mutate({ workspace: ws.slug, versionId: active.id })}
              />
            ) : active && (isVideo && active.sourceType !== "upload" || (active.mimeType?.startsWith("video/") ?? false) || (active.sourceType === "url" && isVideo)) ? (
              <VersionReview key={active.id} version={active} deliverableId={deliverableId} invalidate={invalidate} />
            ) : active && isPdf && (active.publicUrl ?? active.url) ? (
              <PdfReview key={active.id} version={active} invalidate={invalidate} />
            ) : active && isImage ? (
              <ImageReview key={active.id} version={active} invalidate={invalidate} />
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
      <CommentThread target={{ versionId: version.id }} comments={list} activeId={activeId} onSeek={seek} getTime={() => playerRef.current?.getCurrentTime() ?? Promise.resolve(current)} pause={() => playerRef.current?.pause()} invalidate={invalidate} timeCoded />
    </div>
  );
}

/**
 * Image review: the same annotation surface as the PDF, minus paging. Works for
 * jpg/png/gif/webp alike.
 */
function ImageReview({ version, invalidate }: { version: MediaVersion; invalidate: () => Promise<void> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const comments = useQuery(trpc.comments.listByVersion.queryOptions({ workspace: ws.slug, versionId: version.id }));
  const list = useMemo(() => comments.data ?? [], [comments.data]);
  const boxes = useAnnotationBoxes(list);
  const { hidden, toggle: toggleHidden, visible: visibleBoxes } = useHiddenBoxes(boxes);
  const [draft, setDraft] = useState<CommentAnchor | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const viewerRef = useRef<AnnotatedViewerHandle>(null);

  const selectBox = (id: string) => {
    setActiveId(id);
    document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const url = version.publicUrl ?? version.url;
  if (!url) return null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <ImageViewer
          ref={viewerRef}
          url={url}
          alt={version.fileName ?? "asset"}
          boxes={visibleBoxes}
          activeId={activeId}
          draft={draft ? { page: 1, rect: draft.rect, strokes: draft.strokes } : null}
          onHoverBox={setActiveId}
          onSelectBox={selectBox}
          onDraft={(d) => setDraft(d ? { kind: "image", rect: d.rect, strokes: d.strokes } : null)}
        />
        {version.note && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{version.uploaderName ?? "Uploader"}:</span> {version.note}</p>}
      </div>
      <CommentThread
        target={{ versionId: version.id }}
        comments={list}
        activeId={activeId}
        draftAnchor={draft}
        onClearDraftAnchor={() => setDraft(null)}
        onHoverComment={setActiveId}
        onSelectComment={(a, id) => { setActiveId(id); viewerRef.current?.revealAnchor(1, a.rect); }}
        anchorIndex={indexById(boxes)}
        hiddenIds={hidden}
        onToggleHidden={toggleHidden}
        invalidate={invalidate}
        timeCoded={false}
      />
    </div>
  );
}

/**
 * PDF review: page canvas on the left, comment rail on the right. A comment is
 * pinned by dragging a box over the page; hovering a card lights its box up, and
 * clicking the page pill pages the document to it.
 */
type MediaVersion = { id: string; publicUrl?: string | null; url?: string | null; fileName?: string | null; note?: string | null; uploaderName?: string | null };

function PdfReview({ version, invalidate }: { version: MediaVersion; invalidate: () => Promise<void> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const viewerRef = useRef<AnnotatedViewerHandle>(null);
  const comments = useQuery(trpc.comments.listByVersion.queryOptions({ workspace: ws.slug, versionId: version.id }));
  const list = useMemo(() => comments.data ?? [], [comments.data]);
  const [draft, setDraft] = useState<CommentAnchor | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const boxes = useAnnotationBoxes(list);
  const { hidden, toggle: toggleHidden, visible: visibleBoxes } = useHiddenBoxes(boxes);

  // Clicking a box scrolls its card into view; clicking a card pages the document.
  const selectBox = (id: string) => {
    setActiveId(id);
    document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const selectComment = (a: CommentAnchor, id: string) => {
    setActiveId(id);
    viewerRef.current?.revealAnchor(anchorPage(a), a.rect);
  };

  const url = version.publicUrl ?? version.url;
  if (!url) return null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <PdfViewer
          ref={viewerRef}
          url={url}
          boxes={visibleBoxes}
          activeId={activeId}
          draft={draft ? { page: anchorPage(draft), rect: draft.rect, strokes: draft.strokes } : null}
          onHoverBox={setActiveId}
          onSelectBox={selectBox}
          onDraft={(d) => setDraft(d ? { kind: "pdf", page: d.page, rect: d.rect, strokes: d.strokes } : null)}
        />
        {version.note && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{version.uploaderName ?? "Uploader"}:</span> {version.note}</p>}
      </div>
      <CommentThread
        target={{ versionId: version.id }}
        comments={list}
        activeId={activeId}
        draftAnchor={draft}
        onClearDraftAnchor={() => setDraft(null)}
        onHoverComment={setActiveId}
        onSelectComment={selectComment}
        anchorIndex={indexById(boxes)}
        hiddenIds={hidden}
        onToggleHidden={toggleHidden}
        invalidate={invalidate}
        timeCoded={false}
      />
    </div>
  );
}

/** Comment id → marker number, so the rail can label cards like the document. */
function indexById(boxes: AnnotationBox[]): Map<string, number> {
  return new Map(boxes.map((b) => [b.id, b.index]));
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
      <CommentThread target={{ versionId: version.id }} comments={comments.data ?? []} invalidate={invalidate} timeCoded={false} />
    </div>
  );
}

function AddVersionDialog({ open, onOpenChange, deliverableId, kind, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; deliverableId: string; kind: DeliverableKind; onDone: (v: { id: string }) => Promise<void> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const copy = KIND_COPY[kind];
  const usage = useQuery(trpc.files.usage.queryOptions({ workspace: ws.slug }));
  // Free workspaces link video rather than host it; the tab is still shown so the reason is visible.
  const videoBlocked = kind === "video" && usage.data ? !usage.data.videoAllowed : false;
  const [mode, setMode] = useState<"link" | "upload">(copy.defaultMode);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const finish = async (id: string, msg: string) => { await onDone({ id }); onOpenChange(false); setLink(""); setNote(""); setUpload(null); toast.success(msg); };
  const add = useMutation(trpc.deliverables.addVersion.mutationOptions({ onSuccess: (v) => finish(v.id, `v${v.versionNumber} added`), onError: (e) => toast.error(e.message) }));
  const importLink = useMutation(trpc.imports.fromLink.mutationOptions({ onSuccess: (r) => finish(r.versionId!, "Copying the file in…"), onError: (e) => toast.error(e.message) }));
  const importPick = useMutation(trpc.imports.fromProvider.mutationOptions({ onSuccess: (r) => finish(r.versionId!, "Copying the file in…"), onError: (e) => toast.error(e.message) }));
  const onPick = (p: CloudPick) => importPick.mutate({ workspace: ws.slug, target: { deliverableId, note: note || undefined }, provider: p.provider, file: { id: p.id, link: p.link, name: p.name, mimeType: p.mimeType, bytes: p.bytes } });
  const submit = () => {
    if (mode === "link") {
      const cloud = parseVideoLink(link).cloud;
      if (cloud) importLink.mutate({ workspace: ws.slug, target: { deliverableId, note: note || undefined }, url: link.trim() });
      else add.mutate({ workspace: ws.slug, deliverableId, note: note || undefined, link: link.trim() });
    } else if (upload) {
      add.mutate({ workspace: ws.slug, deliverableId, note: note || undefined, upload: { fileId: upload.fileId } });
    }
  };
  const busy = add.isPending || importLink.isPending || importPick.isPending;
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
        {!videoBlocked && <CloudSourceButtons onPick={onPick} disabled={busy} />}
        {mode === "link" ? (
          <div className="grid gap-1.5">
            <Label>{copy.linkLabel}</Label>
            <Input autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder={copy.linkPlaceholder} />
            {parsed && parsed.source !== "url" && <p className="text-2xs text-muted-foreground">Detected: <span className="font-medium capitalize text-foreground">{parsed.source}</span>{parsed.externalId ? ` · ${parsed.externalId}` : ""}</p>}
            {parsed?.cloud && <p className="text-2xs text-muted-foreground">Detected: <span className="font-medium text-foreground">{parsed.cloud.provider === "google_drive" ? "Google Drive" : parsed.cloud.provider === "dropbox" ? "Dropbox" : "Box"}</span> file. Fletcher will copy it into this workspace so everyone can review it.</p>}
          </div>
        ) : videoBlocked ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center">
            <div className="text-xs font-medium">Video uploads need a paid plan</div>
            <p className="mt-1 text-2xs text-muted-foreground">Paste a YouTube or Vimeo link instead — time-coded comments work the same. <Link href={`/w/${ws.slug}/files`} className="underline hover:text-foreground">See plan</Link></p>
            <Button variant="outline" size="xs" className="mt-3" onClick={() => setMode("link")}>Paste a link</Button>
          </div>
        ) : (
          <UploadDropzone folder={`deliverables/${deliverableId}`} accept={copy.accept} hint={copy.uploadHint} onUploaded={setUpload} value={upload} />
        )}
        <div className="grid gap-1.5">
          <Label>Note (optional)</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.notePlaceholder} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit || busy} onClick={submit}>{add.isPending ? "Adding…" : "Add version"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
