import { formatDistanceToNowStrict } from "date-fns";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { formatTimestamp } from "@fletcher/core";

export interface ActivityEntry {
  id: string;
  type: string;
  payload: unknown;
  createdAt: Date | string;
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

export function ActivityFeed({ entries, compact }: { entries: ActivityEntry[]; compact?: boolean }) {
  if (!entries.length) return <p className="px-1 text-xs text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="space-y-3 px-1">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-2.5">
          <MemberAvatar name={e.actorName} size="xs" />
          <div className="min-w-0 text-xs leading-4">
            <span className="font-medium">{e.actorName ?? "Someone"}</span> <span className="text-muted-foreground">{describe(e)}</span>
            <div className="text-2xs text-muted-foreground">{!compact && e.projectName ? `${e.projectName} · ` : ""}{formatDistanceToNowStrict(new Date(e.createdAt), { addSuffix: true })}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
