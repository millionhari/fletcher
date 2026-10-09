"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowUpRight, Check, CheckCircle2, CornerDownRight, Eye, EyeOff, MessageSquare, PenLine, RotateCcw, SquareDashed, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { anchorDisplayColor, anchorPage, commentAnchorSchema, encodeMentions, formatTimestamp, type CommentAnchor, type MentionRef } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { MemberHoverCard } from "@/components/fletcher/member-hover-card";
import { MentionTextarea } from "@/components/fletcher/mentions/mention-textarea";
import { MentionText } from "@/components/fletcher/mentions/mention-text";

export type CommentRow = { id: string; body: string; timestampSeconds: number | null; anchor?: unknown; parentCommentId: string | null; resolvedAt: Date | null; createdAt: Date; authorMemberId: string | null; authorName: string | null; authorRole: string | null };

/** Where the pin sits, spelled out — the marker already carries the identity. */
function anchorLabel(a: CommentAnchor): string {
  const what = a.strokes ? "Drawing" : "Region";
  return a.kind === "pdf" ? `${what} · p.${a.page}` : what;
}

/**
 * The number drawn on the document, repeated in the rail. A numbered marker beats
 * a coloured stripe: it survives a monochrome print, reads the same on both
 * surfaces, and gives people something to name ("look at 3").
 */
function AnchorMarker({ n, color, active }: { n?: number; color: string; active: boolean }) {
  return (
    <span
      aria-hidden
      style={active ? { background: color, borderColor: color, color: "#fff" } : { borderColor: color, color }}
      className="tabular mt-px flex size-5 shrink-0 items-center justify-center rounded-[5px] border font-mono text-[10px] font-semibold leading-none transition-colors"
    >
      {n ?? "·"}
    </span>
  );
}

/** Comments predate the anchor column and it is free-form jsonb, so parse defensively. */
export function readAnchor(value: unknown): CommentAnchor | null {
  if (!value) return null;
  const r = commentAnchorSchema.safeParse(value);
  return r.success ? r.data : null;
}

export type CommentTarget = { versionId: string; taskId?: undefined } | { taskId: string; versionId?: undefined };

/** Threaded comment list + composer. Works for a deliverable version (optionally time-coded) or a task. */
export function CommentThread({ target, comments, activeId = null, onSeek = () => {}, getTime = () => Promise.resolve(0), pause = () => {}, invalidate, timeCoded, className, variant = "card", draftAnchor = null, onClearDraftAnchor, onHoverComment, onSelectComment, anchorIndex, hiddenIds, onToggleHidden }: { target: CommentTarget; comments: CommentRow[]; activeId?: string | null; onSeek?: (s: number) => void; getTime?: () => Promise<number>; pause?: () => void; invalidate: () => Promise<void>; timeCoded: boolean; className?: string;
  /** "card" is the review sidebar rail; "inline" sits in a page column beside other flat sections. */
  variant?: "card" | "inline"; draftAnchor?: CommentAnchor | null; onClearDraftAnchor?: () => void; onHoverComment?: (id: string | null) => void; onSelectComment?: (anchor: CommentAnchor, id: string) => void;
  /** Comment id → the marker number drawn on the document. */
  anchorIndex?: Map<string, number>;
  /** Pinned comments whose markup is hidden on the document, with the toggle. */
  hiddenIds?: Set<string>; onToggleHidden?: (id: string) => void }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<MentionRef[]>([]);
  const [pin, setPin] = useState(timeCoded);
  const [pinned, setPinned] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(true);
  const refresh = async () => {
    if (target.versionId) await qc.invalidateQueries({ queryKey: trpc.comments.listByVersion.queryKey({ workspace: ws.slug, versionId: target.versionId }) });
    else await qc.invalidateQueries({ queryKey: trpc.comments.listByTask.queryKey({ workspace: ws.slug, taskId: target.taskId }) });
    await qc.invalidateQueries({ queryKey: trpc.mentions.pathKey() });
    await invalidate();
  };
  const add = useMutation(trpc.comments.add.mutationOptions({ onSuccess: async () => { setBody(""); setPicked([]); setPinned(null); setReplyTo(null); onClearDraftAnchor?.(); await refresh(); }, onError: (e) => toast.error(e.message) }));
  const resolve = useMutation(trpc.comments.resolve.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(e.message) }));
  const del = useMutation(trpc.comments.delete.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(e.message) }));

  const orderOf = (c: CommentRow) => {
    const a = readAnchor(c.anchor);
    return a ? anchorPage(a) + a.rect.y : Infinity;
  };
  const roots = comments.filter((c) => !c.parentCommentId).filter((c) => showResolved || !c.resolvedAt).sort((a, b) => (a.timestampSeconds ?? Infinity) - (b.timestampSeconds ?? Infinity) || orderOf(a) - orderOf(b) || +new Date(a.createdAt) - +new Date(b.createdAt));
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
    add.mutate({ workspace: ws.slug, ...(target.versionId ? { versionId: target.versionId } : { taskId: target.taskId }), body: encodeMentions(body.trim(), picked), timestampSeconds: replyTo || !target.versionId ? null : pin && pinned != null ? pinned : null, anchor: replyTo ? null : draftAnchor, parentCommentId: replyTo });
  };

  const inline = variant === "inline";
  const Wrapper = inline ? "section" : "aside";

  return (
    <Wrapper className={cn(inline ? "min-w-0" : "surface flex max-h-[calc(100vh-140px)] flex-col", className)}>
      <div className={cn("flex items-center justify-between", inline ? "mb-2" : "border-b border-border px-4 py-2.5")}>
        <div className={cn("flex items-center gap-2", inline ? "text-xs font-semibold uppercase tracking-wider text-muted-foreground" : "text-xs font-semibold")}>
          <MessageSquare className="size-3.5" />Comments <span className="tabular rounded-md bg-muted px-1.5 text-2xs font-medium text-muted-foreground">{openCount} open</span>
        </div>
        <label className="flex items-center gap-1.5 text-2xs text-muted-foreground"><Switch checked={showResolved} onCheckedChange={setShowResolved} className="scale-75" />Resolved</label>
      </div>
      <div className={cn(inline ? "rounded-lg border border-border [&>div:last-child]:border-b-0" : "scrollbar-thin flex-1 overflow-y-auto")}>
        {roots.length === 0 && <p className="px-4 py-8 text-center text-xs text-muted-foreground">No comments yet. {timeCoded ? "Pause where you want to leave a note and start typing." : onSelectComment ? "Draw on the page or drag a box over the part you want to talk about." : "Leave the first note."}</p>}
        {roots.map((c) => {
          const anchor = readAnchor(c.anchor);
          const jump = anchor && onSelectComment ? () => onSelectComment(anchor, c.id) : null;
          return (
          <div
            key={c.id}
            id={`c-${c.id}`}
            onMouseEnter={() => onHoverComment?.(c.id)}
            onMouseLeave={() => onHoverComment?.(null)}
            onClick={jump ?? undefined}
            role={jump ? "button" : undefined}
            tabIndex={jump ? 0 : undefined}
            onKeyDown={jump ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(); } } : undefined}
            className={cn(
              "group border-b border-border px-4 py-3 transition-colors",
              jump && "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
              activeId === c.id && "bg-brand-soft/60",
              c.resolvedAt && "opacity-70",
            )}
          >
            <div className="flex items-start gap-2.5">
              {anchor ? <AnchorMarker n={anchorIndex?.get(c.id)} color={anchorDisplayColor(c.id, anchor)} active={activeId === c.id} /> : <MemberHoverCard memberId={c.authorMemberId}><span className="shrink-0"><MemberAvatar name={c.authorName} size="sm" showTooltip={false} /></span></MemberHoverCard>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <MemberHoverCard memberId={c.authorMemberId}><span className="truncate text-xs font-semibold">{c.authorName ?? "Someone"}</span></MemberHoverCard>
                  {c.timestampSeconds != null && (
                    <button onClick={() => onSeek(c.timestampSeconds!)} className="rounded bg-foreground px-1.5 font-mono text-[10px] font-semibold text-background hover:bg-brand">{formatTimestamp(c.timestampSeconds)}</button>
                  )}
                  {anchor && <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">{anchor.strokes && <PenLine className="size-3" />}{anchorLabel(anchor)}</span>}
                  {anchor && onToggleHidden && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleHidden(c.id); }}
                      aria-pressed={hiddenIds?.has(c.id) ?? false}
                      aria-label={hiddenIds?.has(c.id) ? "Show this markup" : "Hide this markup"}
                      title={hiddenIds?.has(c.id) ? "Show on document" : "Hide on document"}
                      className={cn("rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground", hiddenIds?.has(c.id) && "text-brand")}
                    >
                      {hiddenIds?.has(c.id) ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    </button>
                  )}
                  <span className="ml-auto shrink-0 text-2xs text-muted-foreground">{formatDistanceToNowStrict(new Date(c.createdAt), { addSuffix: true })}</span>
                  {jump && <ArrowUpRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                </div>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-5"><MentionText body={c.body} /></p>
                <div onClick={(e) => e.stopPropagation()} className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button variant="ghost" size="xs" onClick={() => { setReplyTo(c.id); setPinned(null); }}><CornerDownRight />Reply</Button>
                  <Button variant="ghost" size="xs" onClick={() => resolve.mutate({ workspace: ws.slug, commentId: c.id, resolved: !c.resolvedAt })}>{c.resolvedAt ? <><RotateCcw />Reopen</> : <><Check />Resolve</>}</Button>
                  <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => del.mutate({ workspace: ws.slug, commentId: c.id })}><Trash2 /></Button>
                </div>
                {replies(c.id).map((r) => (
                  <div key={r.id} className="mt-2 flex items-start gap-2 border-l-2 border-border pl-2.5">
                    <MemberHoverCard memberId={r.authorMemberId}><span className="shrink-0"><MemberAvatar name={r.authorName} size="xs" showTooltip={false} /></span></MemberHoverCard>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><MemberHoverCard memberId={r.authorMemberId}><span className="text-2xs font-semibold">{r.authorName ?? "Someone"}</span></MemberHoverCard><span className="text-2xs text-muted-foreground">{formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true })}</span></div>
                      <p className="whitespace-pre-line text-xs leading-4"><MentionText body={r.body} /></p>
                    </div>
                  </div>
                ))}
                {c.resolvedAt && <div className="mt-1.5 flex items-center gap-1 text-2xs text-success"><CheckCircle2 className="size-3" />Resolved</div>}
              </div>
            </div>
          </div>
          );
        })}
      </div>
      <div className={cn(inline ? "mt-2" : "border-t border-border p-3")}>
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-2 py-1 text-2xs"><span>Replying to {comments.find((c) => c.id === replyTo)?.authorName ?? "comment"}</span><button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">Cancel</button></div>
        )}
        {draftAnchor && !replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-md border border-brand/40 bg-brand-soft px-2 py-1 text-2xs">
            <span className="flex items-center gap-1.5 text-brand">
              {draftAnchor.strokes ? <><PenLine className="size-3" />{draftAnchor.strokes.length} stroke{draftAnchor.strokes.length === 1 ? "" : "s"} drawn</> : <><SquareDashed className="size-3" />Pinned to a region</>}
              {draftAnchor.kind === "pdf" ? ` on page ${draftAnchor.page}` : ""}
            </span>
            <button onClick={() => onClearDraftAnchor?.()} aria-label="Clear region" className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
          </div>
        )}
        <MentionTextarea ref={textareaRef} value={body} onValueChange={setBody} picked={picked} onPickedChange={setPicked} onFocus={onFocus} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }} placeholder={timeCoded ? "Leave a note at the current time…" : draftAnchor?.strokes ? "What does the drawing mean?" : draftAnchor ? "Describe the change for this region…" : onSelectComment ? "Draw or box the part you mean, or leave a general note…" : "Leave a note… @ to mention someone"} rows={3} className="resize-none text-[13px]" />
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
    </Wrapper>
  );
}

