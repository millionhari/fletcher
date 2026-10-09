"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AtSign, CheckCheck, Circle, CircleCheck } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, SectionHeader } from "@/components/fletcher/page-header";
import { EmptyState } from "@/components/fletcher/empty-state";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { MemberHoverCard } from "@/components/fletcher/member-hover-card";
import { MentionText } from "@/components/fletcher/mentions/mention-text";

type Filter = "unread" | "all";

export function MentionsView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("unread");
  const q = useQuery(trpc.mentions.list.queryOptions({ workspace: ws.slug, filter }));
  const unread = useQuery(trpc.mentions.unreadCount.queryOptions({ workspace: ws.slug }));
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.mentions.pathKey() });
  const setRead = useMutation(trpc.mentions.setRead.mutationOptions({ onSuccess: invalidate, onError: (e) => toast.error(e.message) }));
  const markAll = useMutation(trpc.mentions.markAllRead.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("All caught up"); }, onError: (e) => toast.error(e.message) }));

  const rows = q.data ?? [];
  const unreadCount = unread.data ?? 0;

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Mentions"
        description="Every comment and task brief where a teammate tagged you with @."
        actions={<Button variant="outline" size="sm" disabled={unreadCount === 0 || markAll.isPending} onClick={() => markAll.mutate({ workspace: ws.slug })}><CheckCheck />Mark all read</Button>}
      />
      <SectionHeader
        title={filter === "unread" ? "Unread" : "All mentions"}
        count={q.data ? rows.length : undefined}
        actions={
          <div className="flex items-center gap-1">
            {(["unread", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("box-border inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0 text-xs font-medium leading-none transition-colors", filter === f ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                {f === "unread" ? "Unread" : "All"}
                {f === "unread" && unreadCount > 0 && <span className="tabular text-2xs opacity-70">{unreadCount}</span>}
              </button>
            ))}
          </div>
        }
      />

      {q.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<AtSign />}
          title={filter === "unread" ? "You're all caught up" : "No mentions yet"}
          description={filter === "unread" ? "Nothing unread. New @mentions from comments and task briefs land here." : "When someone types @ and picks your name in a comment or a task brief, it shows up here."}
          action={filter === "unread" ? <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>Show all mentions</Button> : undefined}
        />
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[46%]">Mention</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const isUnread = !m.readAt;
                // A task mention opens the task; a review comment opens the deliverable it was left on.
                const href = m.taskId && m.projectId ? `/w/${ws.slug}/projects/${m.projectId}/tasks/${m.taskId}` : m.deliverableId ? `/w/${ws.slug}/deliverables/${m.deliverableId}` : null;
                const where = m.taskTitle ?? m.deliverableTitle ?? "Deleted item";
                const kind = m.source === "task_doc" ? "Task brief" : m.taskId ? "Task comment" : "Review comment";
                const open = () => {
                  if (!href) return;
                  if (isUnread) setRead.mutate({ workspace: ws.slug, mentionId: m.id, read: true });
                  router.push(href);
                };
                return (
                  <TableRow key={m.id} role={href ? "link" : undefined} tabIndex={href ? 0 : undefined} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }} className={cn("group/row", href && "cursor-pointer", isUnread && "bg-brand-soft/40 hover:bg-brand-soft/60")}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <span aria-hidden className={cn("mt-2 size-1.5 shrink-0 rounded-full", isUnread ? "bg-brand" : "bg-transparent")} />
                        <MemberHoverCard memberId={m.actorMemberId}><span className="shrink-0"><MemberAvatar name={m.actorName} size="sm" showTooltip={false} /></span></MemberHoverCard>
                        <div className="min-w-0">
                          <div className="truncate"><MemberHoverCard memberId={m.actorMemberId}><span className={cn(isUnread ? "font-semibold" : "font-medium")}>{m.actorName ?? "Someone"}</span></MemberHoverCard></div>
                          {m.excerpt && <p className="line-clamp-2 whitespace-pre-line text-xs leading-4 text-muted-foreground"><MentionText body={m.excerpt} /></p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {href ? <Link href={href} onClick={(e) => e.stopPropagation()} className="block max-w-[260px] truncate font-medium hover:underline">{where}</Link> : <span className="text-muted-foreground">{where}</span>}
                      <span className="block text-2xs text-muted-foreground">{kind}</span>
                    </TableCell>
                    <TableCell>
                      {m.projectName ? (
                        <span className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: m.projectColor ?? undefined }} /><span className="truncate">{m.projectName}</span></span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <time dateTime={new Date(m.createdAt).toISOString()}>{formatDistanceToNowStrict(new Date(m.createdAt), { addSuffix: true })}</time>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={isUnread ? "Mark as read" : "Mark as unread"}
                        title={isUnread ? "Mark as read" : "Mark as unread"}
                        onClick={() => setRead.mutate({ workspace: ws.slug, mentionId: m.id, read: isUnread })}
                        className="text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
                      >
                        {isUnread ? <CircleCheck /> : <Circle />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
