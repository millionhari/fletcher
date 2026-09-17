import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import {
  addDaysISO,
  diffDaysISO,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  releaseInfoSchema,
  reshiftTasks,
  timelineTemplateDefSchema,
  todayISO,
  validateTimeline,
} from "@fletcher/core";
import {
  activityLog,
  commsMoments,
  commsPlans,
  createProjectWithTemplates,
  deliverableVersions,
  deliverables,
  projects,
  tasks,
  templates,
  users,
  workspaceMembers,
} from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

async function loadProject(ctx: { db: Db; workspace: { id: string } }, projectId: string) {
  const project = await ctx.db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspace.id)),
  });
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  return project;
}

export const projectsRouter = router({
  list: workspaceProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.projects.findMany({
        where: and(eq(projects.workspaceId, ctx.workspace.id)),
        orderBy: [projects.anchorDate],
      });
      const visible = input.includeArchived ? rows : rows.filter((p) => p.status !== "archived");
      const ids = visible.map((p) => p.id);
      const taskRows = ids.length
        ? await ctx.db
            .select({ projectId: tasks.projectId, status: tasks.status, dueDate: tasks.dueDate })
            .from(tasks)
            .where(inArray(tasks.projectId, ids))
        : [];
      const today = todayISO();
      return visible.map((p) => {
        const mine = taskRows.filter((t) => t.projectId === p.id);
        const done = mine.filter((t) => t.status === "done").length;
        const overdue = mine.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;
        const next = mine
          .filter((t) => t.status !== "done" && t.dueDate && t.dueDate >= today)
          .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
        return {
          ...p,
          taskCount: mine.length,
          doneCount: done,
          overdueCount: overdue,
          nextDueDate: next?.dueDate ?? null,
          daysUntilAnchor: diffDaysISO(p.anchorDate, today),
        };
      });
    }),

  get: workspaceProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const project = await loadProject(ctx, input.projectId);
    const taskRows = await ctx.db
      .select({
        task: tasks,
        assigneeName: users.name,
      })
      .from(tasks)
      .leftJoin(workspaceMembers, eq(tasks.assigneeMemberId, workspaceMembers.id))
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(tasks.projectId, project.id))
      .orderBy(tasks.dueDate, tasks.sortOrder);
    const taskList = taskRows.map((r) => ({ ...r.task, assigneeName: r.assigneeName }));

    const deliverableRows = await ctx.db.query.deliverables.findMany({
      where: eq(deliverables.projectId, project.id),
      with: { versions: { orderBy: [desc(deliverableVersions.versionNumber)], limit: 1 } },
    });

    const children = await ctx.db.query.projects.findMany({ where: eq(projects.parentProjectId, project.id) });
    const parent = project.parentProjectId
      ? await ctx.db.query.projects.findFirst({ where: eq(projects.id, project.parentProjectId) })
      : null;
    const plan = await ctx.db.query.commsPlans.findFirst({ where: eq(commsPlans.projectId, project.id) });
    const momentRows = plan
      ? await ctx.db.select({ id: commsMoments.id, isChecklist: commsMoments.isChecklist, status: commsMoments.status }).from(commsMoments).where(eq(commsMoments.planId, plan.id))
      : [];
    const template = project.timelineTemplateId
      ? await ctx.db.query.templates.findFirst({ where: eq(templates.id, project.timelineTemplateId) })
      : null;
    const phases = template ? timelineTemplateDefSchema.parse(template.definition).phases : [];
    const options = template ? (timelineTemplateDefSchema.parse(template.definition).options ?? []) : [];

    const warnings = validateTimeline(
      taskList.map((t) => ({ id: t.id, templateKey: t.templateKey, title: t.title, startDate: t.startDate, dueDate: t.dueDate, isDateOverridden: t.isDateOverridden, status: t.status, dependsOn: t.dependsOn })),
      todayISO(),
    );

    return {
      project,
      parent,
      children,
      tasks: taskList,
      deliverables: deliverableRows.map((d) => ({ ...d, latestVersion: d.versions[0] ?? null })),
      phases,
      options,
      commsSummary: { planId: plan?.id ?? null, momentCount: momentRows.filter((m) => !m.isChecklist).length, postedCount: momentRows.filter((m) => m.status === "posted").length },
      warnings,
    };
  }),

  create: workspaceProcedure
    .input(
      z.object({
        type: z.enum(PROJECT_TYPES),
        name: z.string().min(1),
        anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        timelineTemplateId: z.string().uuid().nullable().optional(),
        commsTemplateId: z.string().uuid().nullable().optional(),
        enabledOptions: z.array(z.string()).default([]),
        parentProjectId: z.string().uuid().nullable().optional(),
        releaseInfo: releaseInfoSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await createProjectWithTemplates(ctx.db, {
        workspaceId: ctx.workspace.id,
        type: input.type,
        name: input.name,
        anchorDate: input.anchorDate,
        timelineTemplateId: input.timelineTemplateId ?? undefined,
        commsTemplateId: input.commsTemplateId ?? undefined,
        enabledOptions: input.enabledOptions,
        parentProjectId: input.parentProjectId ?? null,
        releaseInfo: input.releaseInfo,
        timezone: ctx.workspace.timezone,
      });
      await ctx.db.insert(activityLog).values({
        workspaceId: ctx.workspace.id,
        projectId: project.id,
        actorMemberId: ctx.member.id,
        type: "project.created",
        payload: { name: project.name },
      });
      return project;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).optional(),
        status: z.enum(PROJECT_STATUSES).optional(),
        color: z.string().optional(),
        notes: z.string().nullable().optional(),
        releaseInfo: releaseInfoSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await loadProject(ctx, input.projectId);
      const { projectId, ...rest } = input;
      const [updated] = await ctx.db
        .update(projects)
        .set({ ...rest, updatedAt: new Date() })
        .where(eq(projects.id, project.id))
        .returning();
      return updated!;
    }),

  /** Preview what a date change would do without committing it. */
  previewAnchorChange: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid(), newAnchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const project = await loadProject(ctx, input.projectId);
      const rows = await ctx.db.select().from(tasks).where(eq(tasks.projectId, project.id));
      const result = reshiftTasks(
        rows.map((t) => ({ id: t.id, templateKey: t.templateKey, title: t.title, startDate: t.startDate, dueDate: t.dueDate, isDateOverridden: t.isDateOverridden, status: t.status, dependsOn: t.dependsOn })),
        project.anchorDate,
        input.newAnchorDate,
      );
      const warnings = validateTimeline(result.tasks);
      return {
        deltaDays: result.deltaDays,
        shifted: result.shiftedIds.length,
        kept: result.keptIds.length,
        warnings,
        preview: result.tasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, kept: result.keptIds.includes(t.id) })),
      };
    }),

  changeAnchorDate: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid(), newAnchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const project = await loadProject(ctx, input.projectId);
      const rows = await ctx.db.select().from(tasks).where(eq(tasks.projectId, project.id));
      const result = reshiftTasks(
        rows.map((t) => ({ id: t.id, templateKey: t.templateKey, startDate: t.startDate, dueDate: t.dueDate, isDateOverridden: t.isDateOverridden })),
        project.anchorDate,
        input.newAnchorDate,
      );
      for (const t of result.tasks) {
        if (!result.shiftedIds.includes(t.id)) continue;
        await ctx.db.update(tasks).set({ startDate: t.startDate, dueDate: t.dueDate, updatedAt: new Date() }).where(eq(tasks.id, t.id));
      }
      // Shift dated comms moments too.
      const plan = await ctx.db.query.commsPlans.findFirst({ where: eq(commsPlans.projectId, project.id) });
      if (plan && result.deltaDays !== 0) {
        const moments = await ctx.db.select().from(commsMoments).where(and(eq(commsMoments.planId, plan.id), isNotNull(commsMoments.scheduledDate)));
        for (const m of moments) {
          await ctx.db.update(commsMoments).set({ scheduledDate: addDaysISO(m.scheduledDate!, result.deltaDays) }).where(eq(commsMoments.id, m.id));
        }
      }
      const [updated] = await ctx.db.update(projects).set({ anchorDate: input.newAnchorDate, updatedAt: new Date() }).where(eq(projects.id, project.id)).returning();
      await ctx.db.insert(activityLog).values({
        workspaceId: ctx.workspace.id,
        projectId: project.id,
        actorMemberId: ctx.member.id,
        type: "project.date_changed",
        payload: { from: project.anchorDate, to: input.newAnchorDate, shifted: result.shiftedIds.length, kept: result.keptIds.length },
      });
      return { project: updated!, shifted: result.shiftedIds.length, kept: result.keptIds.length, deltaDays: result.deltaDays };
    }),

  archive: workspaceProcedure.input(z.object({ projectId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const project = await loadProject(ctx, input.projectId);
    await ctx.db.update(projects).set({ status: "archived", updatedAt: new Date() }).where(eq(projects.id, project.id));
    return { ok: true };
  }),

  delete: workspaceProcedure.input(z.object({ projectId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const project = await loadProject(ctx, input.projectId);
    await ctx.db.delete(projects).where(eq(projects.id, project.id));
    return { ok: true };
  }),
});
