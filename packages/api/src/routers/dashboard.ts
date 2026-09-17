import { and, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { addDaysISO, todayISO } from "@fletcher/core";
import { activityLog, commsMoments, commsPlans, projects, tasks, users, workspaceMembers } from "@fletcher/db";
import { router, workspaceProcedure } from "../trpc";

export const dashboardRouter = router({
  overview: workspaceProcedure.input(z.object({ horizonDays: z.number().int().min(1).max(120).default(30) })).query(async ({ ctx, input }) => {
    const today = todayISO();
    const horizon = addDaysISO(today, input.horizonDays);
    const projectRows = await ctx.db.select().from(projects).where(and(eq(projects.workspaceId, ctx.workspace.id), ne(projects.status, "archived")));
    const ids = projectRows.map((p) => p.id);
    if (!ids.length) return { today, projects: [], overdue: [], upcoming: [], moments: [], activity: [] };

    const base = ctx.db
      .select({ task: tasks, projectName: projects.name, projectColor: projects.color, assigneeName: users.name })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(workspaceMembers, eq(tasks.assigneeMemberId, workspaceMembers.id))
      .leftJoin(users, eq(workspaceMembers.userId, users.id));

    const overdue = await base.where(and(inArray(tasks.projectId, ids), ne(tasks.status, "done"), lt(tasks.dueDate, today))).orderBy(tasks.dueDate);
    const upcoming = await base
      .where(and(inArray(tasks.projectId, ids), ne(tasks.status, "done"), gte(tasks.dueDate, today), lt(tasks.dueDate, horizon)))
      .orderBy(tasks.dueDate, tasks.sortOrder);

    const moments = await ctx.db
      .select({ moment: commsMoments, projectName: projects.name, projectColor: projects.color, projectId: projects.id })
      .from(commsMoments)
      .innerJoin(commsPlans, eq(commsMoments.planId, commsPlans.id))
      .innerJoin(projects, eq(commsPlans.projectId, projects.id))
      .where(and(inArray(projects.id, ids), gte(commsMoments.scheduledDate, today), lt(commsMoments.scheduledDate, horizon), ne(commsMoments.status, "posted")))
      .orderBy(commsMoments.scheduledDate, commsMoments.scheduledTime);

    const activity = await ctx.db
      .select({ entry: activityLog, actorName: users.name, projectName: projects.name })
      .from(activityLog)
      .leftJoin(workspaceMembers, eq(activityLog.actorMemberId, workspaceMembers.id))
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .leftJoin(projects, eq(activityLog.projectId, projects.id))
      .where(eq(activityLog.workspaceId, ctx.workspace.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(20);

    const allTasks = await ctx.db.select({ projectId: tasks.projectId, status: tasks.status }).from(tasks).where(inArray(tasks.projectId, ids));

    return {
      today,
      projects: projectRows.map((p) => {
        const mine = allTasks.filter((t) => t.projectId === p.id);
        return { ...p, taskCount: mine.length, doneCount: mine.filter((t) => t.status === "done").length };
      }),
      overdue: overdue.map((r) => ({ ...r.task, projectName: r.projectName, projectColor: r.projectColor, assigneeName: r.assigneeName })),
      upcoming: upcoming.map((r) => ({ ...r.task, projectName: r.projectName, projectColor: r.projectColor, assigneeName: r.assigneeName })),
      moments: moments.map((r) => ({ ...r.moment, projectName: r.projectName, projectColor: r.projectColor, projectId: r.projectId })),
      activity: activity.map((r) => ({ ...r.entry, actorName: r.actorName, projectName: r.projectName })),
    };
  }),

  /** Everything dated in a month, for the calendar. */
  calendar: workspaceProcedure
    .input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const projectRows = await ctx.db.select().from(projects).where(and(eq(projects.workspaceId, ctx.workspace.id), ne(projects.status, "archived")));
      const ids = projectRows.map((p) => p.id);
      if (!ids.length) return { tasks: [], moments: [], projects: [] };
      const taskRows = await ctx.db
        .select({ task: tasks, projectName: projects.name, projectColor: projects.color })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(inArray(tasks.projectId, ids), gte(tasks.dueDate, input.from), lt(tasks.dueDate, input.to)))
        .orderBy(tasks.dueDate);
      const momentRows = await ctx.db
        .select({ moment: commsMoments, projectName: projects.name, projectColor: projects.color, projectId: projects.id })
        .from(commsMoments)
        .innerJoin(commsPlans, eq(commsMoments.planId, commsPlans.id))
        .innerJoin(projects, eq(commsPlans.projectId, projects.id))
        .where(and(inArray(projects.id, ids), gte(commsMoments.scheduledDate, input.from), lt(commsMoments.scheduledDate, input.to)))
        .orderBy(commsMoments.scheduledDate);
      return {
        projects: projectRows.map((p) => ({ id: p.id, name: p.name, color: p.color, anchorDate: p.anchorDate, anchorLabel: p.anchorLabel })),
        tasks: taskRows.map((r) => ({ ...r.task, projectName: r.projectName, projectColor: r.projectColor })),
        moments: momentRows.map((r) => ({ ...r.moment, projectName: r.projectName, projectColor: r.projectColor, projectId: r.projectId })),
      };
    }),
});
