import { eq } from "drizzle-orm";
import { z } from "zod";
import { activityLog, comments, deliverableVersions, deliverables, projects, tasks, users, workspaceMembers } from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

async function loadVersion(ctx: { db: Db; workspace: { id: string } }, versionId: string) {
  const v = await ctx.db.query.deliverableVersions.findFirst({ where: eq(deliverableVersions.id, versionId) });
  if (!v) throw new TRPCError({ code: "NOT_FOUND" });
  const d = await ctx.db.query.deliverables.findFirst({ where: eq(deliverables.id, v.deliverableId) });
  if (!d || d.workspaceId !== ctx.workspace.id) throw new TRPCError({ code: "NOT_FOUND" });
  return { version: v as typeof deliverableVersions.$inferSelect, deliverable: d as typeof deliverables.$inferSelect };
}

async function loadTask(ctx: { db: Db; workspace: { id: string } }, taskId: string) {
  const row = await ctx.db.select({ task: tasks, workspaceId: projects.workspaceId }).from(tasks).innerJoin(projects, eq(tasks.projectId, projects.id)).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!row || row.workspaceId !== ctx.workspace.id) throw new TRPCError({ code: "NOT_FOUND" });
  return row.task;
}

export const commentsRouter = router({
  listByTask: workspaceProcedure.input(z.object({ taskId: z.string().uuid() })).query(async ({ ctx, input }) => {
    await loadTask(ctx, input.taskId);
    const rows = await ctx.db
      .select({ comment: comments, authorName: users.name, authorRole: workspaceMembers.role })
      .from(comments)
      .leftJoin(workspaceMembers, eq(comments.authorMemberId, workspaceMembers.id))
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(comments.taskId, input.taskId))
      .orderBy(comments.createdAt);
    return rows.map((r) => ({ ...r.comment, authorName: r.authorName, authorRole: r.authorRole }));
  }),

  listByVersion: workspaceProcedure.input(z.object({ versionId: z.string().uuid() })).query(async ({ ctx, input }) => {
    await loadVersion(ctx, input.versionId);
    const rows = await ctx.db
      .select({ comment: comments, authorName: users.name, authorRole: workspaceMembers.role })
      .from(comments)
      .leftJoin(workspaceMembers, eq(comments.authorMemberId, workspaceMembers.id))
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(comments.versionId, input.versionId))
      .orderBy(comments.createdAt);
    return rows.map((r) => ({ ...r.comment, authorName: r.authorName, authorRole: r.authorRole }));
  }),

  add: workspaceProcedure
    .input(
      z
        .object({ versionId: z.string().uuid().optional(), taskId: z.string().uuid().optional(), body: z.string().min(1), timestampSeconds: z.number().nonnegative().nullable().optional(), parentCommentId: z.string().uuid().nullable().optional() })
        .refine((v) => !!v.versionId !== !!v.taskId, { message: "Provide exactly one of versionId or taskId" }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.taskId) {
        const task = await loadTask(ctx, input.taskId);
        const [c] = await ctx.db
          .insert(comments)
          .values({ taskId: task.id, authorMemberId: ctx.member.id, body: input.body, parentCommentId: input.parentCommentId ?? null })
          .returning();
        await ctx.db.insert(activityLog).values({ workspaceId: ctx.workspace.id, projectId: task.projectId, taskId: task.id, actorMemberId: ctx.member.id, type: "comment.added", payload: { title: task.title, taskId: task.id } });
        return c!;
      }
      const { deliverable } = await loadVersion(ctx, input.versionId!);
      const [c] = await ctx.db
        .insert(comments)
        .values({ versionId: input.versionId!, authorMemberId: ctx.member.id, body: input.body, timestampSeconds: input.timestampSeconds ?? null, parentCommentId: input.parentCommentId ?? null })
        .returning();
      await ctx.db.insert(activityLog).values({
        workspaceId: ctx.workspace.id,
        projectId: deliverable.projectId,
        actorMemberId: ctx.member.id,
        type: "comment.added",
        payload: { title: deliverable.title, timestamp: input.timestampSeconds ?? null, deliverableId: deliverable.id },
      });
      return c!;
    }),

  resolve: workspaceProcedure.input(z.object({ commentId: z.string().uuid(), resolved: z.boolean() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.db.query.comments.findFirst({ where: eq(comments.id, input.commentId) });
    if (!c) throw new TRPCError({ code: "NOT_FOUND" });
    if (c.taskId) await loadTask(ctx, c.taskId);
    else await loadVersion(ctx, c.versionId!);
    const [updated] = await ctx.db
      .update(comments)
      .set({ resolvedAt: input.resolved ? new Date() : null, resolvedByMemberId: input.resolved ? ctx.member.id : null })
      .where(eq(comments.id, c.id))
      .returning();
    return updated!;
  }),

  delete: workspaceProcedure.input(z.object({ commentId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.db.query.comments.findFirst({ where: eq(comments.id, input.commentId) });
    if (!c) throw new TRPCError({ code: "NOT_FOUND" });
    if (c.taskId) await loadTask(ctx, c.taskId);
    else await loadVersion(ctx, c.versionId!);
    await ctx.db.delete(comments).where(eq(comments.id, c.id));
    await ctx.db.delete(comments).where(eq(comments.parentCommentId, c.id));
    return { ok: true };
  }),
});
