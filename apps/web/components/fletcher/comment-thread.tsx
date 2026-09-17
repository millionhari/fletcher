"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Check, CheckCircle2, CornerDownRight, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MemberAvatar } from "@/components/fletcher/member-avatar";

export type CommentRow = { id: string; body: string; timestampSeconds: number | null; parentCommentId: string | null; resolvedAt: Date | null; createdAt: Date; authorName: string | null; authorRole: string | null };

export type CommentTarget = { versionId: string; taskId?: undefined } | { taskId: string; versionId?: undefined };

/** Threaded comment list + composer. Works for a deliverable version (optionally time-coded) or a task. */
export function CommentThread({ target, comments, activeId = null, onSeek = () => {}, getTime = () => Promise.resolve(0), pause = () => {}, invalidate, timeCoded, className }: { target: CommentTarget; comments: CommentRow[]; activeId?: string | null; onSeek?: (s: number) => void; getTime?: () => Promise<number>; pause?: () => void; invalidate: () => Promise<void>; timeCoded: boolean; className?: string }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(timeCoded);
  const [pinned, setPinned] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(true);
  const refresh = async () => {
    if (target.versionId) await qc.invalidateQueries({ queryKey: trpc.comments.listByVersion.queryKey({ workspace: ws.slug, versionId: target.versionId }) });
    else await qc.invalidateQueries({ queryKey: trpc.comments.listByTask.queryKey({ workspace: ws.slug, taskId: target.taskId }) });
    await invalidate();
  };
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
    add.mutate({ workspace: ws.slug, ...(target.versionId ? { versionId: target.versionId } : { taskId: target.taskId }), body: body.trim(), timestampSeconds: replyTo || !target.versionId ? null : pin && pinned != null ? pinned : null, parentCommentId: replyTo });
  };

  return (
    <aside className={cn("surface flex max-h-[calc(100vh-140px)] flex-col", className)}>
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

