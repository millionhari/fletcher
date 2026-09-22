import { and, eq, inArray } from "drizzle-orm";
import { mentions, workspaceMembers } from "@fletcher/db";
import type { Db } from "@fletcher/db";

export interface MentionTarget {
  source: "comment" | "task_doc";
  projectId: string | null;
  taskId?: string | null;
  deliverableId?: string | null;
  commentId?: string | null;
  excerpt: string;
}

/**
 * Write one mention row per tagged member. Ids come from the client, so they
 * are filtered to real members of this workspace first — a forged id tags no
 * one. Tagging yourself is kept: it is a deliberate act and reads as a note to
 * self on the Mentions page.
 */
export async function recordMentions(
  ctx: { db: Db; workspace: { id: string }; member: { id: string } },
  memberIds: string[],
  target: MentionTarget,
): Promise<number> {
  const unique = [...new Set(memberIds)];
  if (!unique.length) return 0;
  const valid = await ctx.db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), inArray(workspaceMembers.id, unique)));
  if (!valid.length) return 0;
  await ctx.db.insert(mentions).values(
    valid.map((m) => ({
      workspaceId: ctx.workspace.id,
      mentionedMemberId: m.id,
      actorMemberId: ctx.member.id,
      source: target.source,
      projectId: target.projectId,
      taskId: target.taskId ?? null,
      deliverableId: target.deliverableId ?? null,
      commentId: target.commentId ?? null,
      excerpt: target.excerpt.slice(0, 500),
    })),
  );
  return valid.length;
}
