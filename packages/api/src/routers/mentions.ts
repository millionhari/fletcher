import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { deliverables, mentions, projects, tasks, users, workspaceMembers } from "@fletcher/db";
import { router, workspaceProcedure } from "../trpc";

/** Everything here is scoped to the calling member — nobody reads anyone else's mentions. */
export const mentionsRouter = router({
  list: workspaceProcedure
    .input(z.object({ filter: z.enum(["unread", "all"]).default("all"), limit: z.number().int().min(1).max(200).default(100) }))
    .query(async ({ ctx, input }) => {
      const actor = alias(workspaceMembers, "actor");
      const rows = await ctx.db
        .select({
          mention: mentions,
          actorName: users.name,
          projectName: projects.name,
          projectColor: projects.color,
          taskTitle: tasks.title,
          deliverableTitle: deliverables.title,
        })
        .from(mentions)
        .leftJoin(actor, eq(mentions.actorMemberId, actor.id))
        .leftJoin(users, eq(actor.userId, users.id))
        .leftJoin(projects, eq(mentions.projectId, projects.id))
        .leftJoin(tasks, eq(mentions.taskId, tasks.id))
        .leftJoin(deliverables, eq(mentions.deliverableId, deliverables.id))
        .where(and(eq(mentions.mentionedMemberId, ctx.member.id), input.filter === "unread" ? isNull(mentions.readAt) : undefined))
        .orderBy(desc(mentions.createdAt))
        .limit(input.limit);
      return rows.map((r) => ({ ...r.mention, actorName: r.actorName, projectName: r.projectName, projectColor: r.projectColor, taskTitle: r.taskTitle, deliverableTitle: r.deliverableTitle }));
    }),

  unreadCount: workspaceProcedure.query(async ({ ctx }) => {
    const row = await ctx.db
      .select({ n: sql<number>`count(*)::int` })
      .from(mentions)
      .where(and(eq(mentions.mentionedMemberId, ctx.member.id), isNull(mentions.readAt)))
      .then((r) => r[0]);
    return row?.n ?? 0;
  }),

  setRead: workspaceProcedure.input(z.object({ mentionId: z.string().uuid(), read: z.boolean() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(mentions)
      .set({ readAt: input.read ? new Date() : null })
      .where(and(eq(mentions.id, input.mentionId), eq(mentions.mentionedMemberId, ctx.member.id)));
    return { ok: true };
  }),

  markAllRead: workspaceProcedure.mutation(async ({ ctx }) => {
    await ctx.db.update(mentions).set({ readAt: new Date() }).where(and(eq(mentions.mentionedMemberId, ctx.member.id), isNull(mentions.readAt)));
    return { ok: true };
  }),
});
