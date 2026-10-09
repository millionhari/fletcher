"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { MemberHoverCard } from "@/components/fletcher/member-hover-card";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { formatTimestamp } from "@fletcher/core";

export interface ActivityEntry {
  id: string;
  type: string;
  payload: unknown;
  createdAt: Date | string;
  projectId: string | null;
  taskId: string | null;
  actorMemberId: string | null;
  actorName: string | null;
  projectName: string | null;
}

function describe(e: ActivityEntry): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  switch (e.type) {
    case "project.created":
      return `created project ${p.name as string}`;
    case "project.date_changed":
      return `moved the date to ${p.to as string} (${p.shifted as number} tasks shifted, ${p.kept as number} kept)`;
    case "version.added":
      return `uploaded v${p.version as number} of ${p.title as string}`;
    case "comment.added":
      return p.timestamp != null ? `commented at ${formatTimestamp(p.timestamp as number)} on ${p.title as string}` : `commented on ${p.title as string}`;
    case "deliverable.status":
      return `marked ${p.title as string} as ${String(p.status).replace("_", " ")}`;
    case "task.status":
      return `set ${p.title as string} to ${String(p.status).replace("_", " ")}`;
    case "task.date":
      return `moved ${p.title as string} to ${p.to as string}`;
    case "task.assignee":
      return p.assigneeMemberId ? `reassigned ${p.title as string}` : `unassigned ${p.title as string}`;
    case "task.renamed":
      return `renamed "${p.from as string}" to "${p.to as string}"`;
    case "task.checklist":
      return `${p.done ? "checked" : "unchecked"} "${p.title as string}"`;
    case "task.attachment":
      return `attached ${p.title as string}`;
    default:
      return e.type;
  }
}

/** Where an entry points: the task, the deliverable under review, or the project. Older
 *  deliverable entries predate `payload.deliverableId`, so they fall back to the project's list. */
function hrefFor(e: ActivityEntry, base: string, compact?: boolean): string | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  if (typeof p.deliverableId === "string") return `${base}/deliverables/${p.deliverableId}`;
  if (!e.projectId) return null;
  const project = `${base}/projects/${e.projectId}`;
  // In the task panel every entry is about the open task, so a link would go nowhere new.
  if (e.taskId) return compact ? null : `${project}/timeline?task=${e.taskId}`;
  if (e.type === "version.added" || e.type === "deliverable.status" || e.type === "comment.added") return `${project}/deliverables`;
  return project;
}

export function ActivityFeed({ entries, compact }: { entries: ActivityEntry[]; compact?: boolean }) {
  const ws = useWorkspace();
  if (!entries.length) return <p className="px-1 text-xs text-muted-foreground">No activity yet.</p>;
  const base = `/w/${ws.slug}`;
  return (
    <ol className="-mx-1">
      {entries.map((e) => {
        const href = hrefFor(e, base, compact);
        const body = (
          <>
            <MemberHoverCard memberId={e.actorMemberId}>
              <span className="shrink-0"><MemberAvatar name={e.actorName} size="xs" showTooltip={false} /></span>
            </MemberHoverCard>
            <div className="min-w-0 text-xs leading-4">
              <MemberHoverCard memberId={e.actorMemberId}>
                <span className="font-medium hover:underline">{e.actorName ?? "Someone"}</span>
              </MemberHoverCard>{" "}
              <span className="text-muted-foreground">{describe(e)}</span>
              <div className="text-2xs text-muted-foreground">{!compact && e.projectName ? `${e.projectName} · ` : ""}{formatDistanceToNowStrict(new Date(e.createdAt), { addSuffix: true })}</div>
            </div>
          </>
        );
        return (
          <li key={e.id}>
            {href ? (
              <Link href={href} className="flex gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">{body}</Link>
            ) : (
              <div className="flex gap-2.5 px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
