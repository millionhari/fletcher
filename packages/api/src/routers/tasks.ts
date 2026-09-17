import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { MEMBER_ROLES, TASK_STATUSES } from "@fletcher/core";
import { activityLog, createProjectWithTemplates, deliverables, projects, tasks } from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

async function loadTask(ctx: { db: Db; workspace: { id: string } }, taskId: string) {
  const row = await ctx.db
    .select({ task: tasks, workspaceId: projects.workspaceId })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .then((r) => r[0]);
  if (!row || row.workspaceId !== ctx.workspace.id) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
  return row.task as typeof tasks.$inferSelect;
}

export const tasksRouter = router({
  update: workspaceProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(TASK_STATUSES).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        assigneeMemberId: z.string().uuid().nullable().optional(),
        roleKey: z.enum(MEMBER_ROLES).nullable().optional(),
        phase: z.string().optional(),
        /** Reset a manually-overridden date back to following the anchor. */
        clearOverride: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(ctx, input.taskId);
      const { taskId, clearOverride, ...rest } = input;
      const patch: Partial<typeof tasks.$inferInsert> = { ...rest, updatedAt: new Date() };
      if (input.dueDate !== undefined || input.startDate !== undefined) patch.isDateOverridden = true;
      if (clearOverride) patch.isDateOverridden = false;
      const [updated] = await ctx.db.update(tasks).set(patch).where(eq(tasks.id, task.id)).returning();
      if (input.status && input.status !== task.status) {
        await ctx.db.insert(activityLog).values({ workspaceId: ctx.workspace.id, projectId: task.projectId, taskId: task.id, actorMemberId: ctx.member.id, type: "task.status", payload: { title: task.title, status: input.status } });
      }
      if (input.dueDate !== undefined && input.dueDate !== task.dueDate) {
        await ctx.db.insert(activityLog).values({ workspaceId: ctx.workspace.id, projectId: task.projectId, taskId: task.id, actorMemberId: ctx.member.id, type: "task.date", payload: { title: task.title, from: task.dueDate, to: input.dueDate } });
      }
      if (input.assigneeMemberId !== undefined && input.assigneeMemberId !== task.assigneeMemberId) {
        await ctx.db.insert(activityLog).values({ workspaceId: ctx.workspace.id, projectId: task.projectId, taskId: task.id, actorMemberId: ctx.member.id, type: "task.assignee", payload: { title: task.title, assigneeMemberId: input.assigneeMemberId } });
      }
      return updated!;
    }),

  create: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1),
        phase: z.string().default("general"),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        roleKey: z.enum(MEMBER_ROLES).nullable().optional(),
        assigneeMemberId: z.string().uuid().nullable().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({ where: and(eq(projects.id, input.projectId), eq(projects.workspaceId, ctx.workspace.id)) });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const [task] = await ctx.db
        .insert(tasks)
        .values({
          projectId: project.id,
          title: input.title,
          phase: input.phase,
          dueDate: input.dueDate ?? null,
          startDate: input.dueDate ?? null,
          roleKey: input.roleKey ?? null,
          assigneeMemberId: input.assigneeMemberId ?? null,
          description: input.description ?? null,
          isDateOverridden: true,
          sortOrder: 9999,
        })
        .returning();
      return task!;
    }),

  delete: workspaceProcedure.input(z.object({ taskId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const task = await loadTask(ctx, input.taskId);
    await ctx.db.delete(tasks).where(eq(tasks.id, task.id));
    return { ok: true };
  }),

  bulkStatus: workspaceProcedure
    .input(z.object({ taskIds: z.array(z.string().uuid()).min(1), status: z.enum(TASK_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ id: tasks.id })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(inArray(tasks.id, input.taskIds), eq(projects.workspaceId, ctx.workspace.id)));
      const ids = rows.map((r) => r.id);
      if (ids.length) await ctx.db.update(tasks).set({ status: input.status, updatedAt: new Date() }).where(inArray(tasks.id, ids));
      return { updated: ids.length };
    }),

  /** Turn a milestone task (e.g. "Single 2") into a child project on the milestone's date. */
  createProjectFromMilestone: workspaceProcedure
    .input(z.object({ taskId: z.string().uuid(), name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(ctx, input.taskId);
      const milestone = task.milestone as { projectType: any; label: string } | null;
      if (!milestone) throw new TRPCError({ code: "BAD_REQUEST", message: "Not a milestone task" });
      if (task.childProjectId) throw new TRPCError({ code: "CONFLICT", message: "Project already created" });
      if (!task.dueDate) throw new TRPCError({ code: "BAD_REQUEST", message: "Milestone has no date" });
      const parent = await ctx.db.query.projects.findFirst({ where: eq(projects.id, task.projectId) });
      const child = await createProjectWithTemplates(ctx.db, {
        workspaceId: ctx.workspace.id,
        type: milestone.projectType,
        name: input.name ?? `${parent?.name ?? "Album"} — ${milestone.label}`,
        anchorDate: task.dueDate,
        parentProjectId: task.projectId,
        timezone: ctx.workspace.timezone,
      });
      await ctx.db.update(tasks).set({ childProjectId: child.id, updatedAt: new Date() }).where(eq(tasks.id, task.id));
      return child;
    }),

  /** Attach a deliverable to a task (creating one if needed) so it can be reviewed. */
  ensureDeliverable: workspaceProcedure
    .input(z.object({ taskId: z.string().uuid(), kind: z.enum(["video", "image", "audio", "document", "link"]).default("video") }))
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(ctx, input.taskId);
      if (task.deliverableId) return { deliverableId: task.deliverableId };
      const [d] = await ctx.db
        .insert(deliverables)
        .values({ workspaceId: ctx.workspace.id, projectId: task.projectId, kind: input.kind, title: task.title })
        .returning({ id: deliverables.id });
      await ctx.db.update(tasks).set({ deliverableId: d!.id }).where(eq(tasks.id, task.id));
      return { deliverableId: d!.id };
    }),
});
