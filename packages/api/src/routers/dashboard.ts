import { and, desc, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { addDaysISO, todayISO } from "@fletcher/core";
import { activityLog, commsMomentItems, commsMoments, commsPlans, projects, tasks, users, workspaceMembers } from "@fletcher/db";
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

  /** Open work for one member (or everyone): tasks + rollout checklist items, bucketed by urgency. */
  workFor: workspaceProcedure
    .input(z.object({ memberId: z.string().uuid().nullable().optional(), horizonDays: z.number().int().min(7).max(180).default(60), includeDone: z.boolean().default(true) }))
    .query(async ({ ctx, input }) => {
      const today = todayISO();
      const weekEnd = addDaysISO(today, 7);
      const horizon = addDaysISO(today, input.horizonDays);
      const memberId = input.memberId === undefined ? ctx.member.id : input.memberId;
      // Completed work is kept for 30 days so "what did I get done" stays visible without the list growing forever.
      const doneSince = new Date(Date.now() - 30 * 86400000).toISOString();
      const taskRows = await ctx.db
        .select({ task: tasks, projectId: projects.id, projectName: projects.name, projectColor: projects.color, assigneeName: users.name })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(workspaceMembers, eq(tasks.assigneeMemberId, workspaceMembers.id))
        .leftJoin(users, eq(workspaceMembers.userId, users.id))
        .where(and(eq(projects.workspaceId, ctx.workspace.id), ne(projects.status, "archived"), input.includeDone ? sql`(${tasks.status} <> 'done' or ${tasks.updatedAt} >= ${doneSince})` : ne(tasks.status, "done"), memberId ? eq(tasks.assigneeMemberId, memberId) : undefined, memberId ? undefined : sql`(${tasks.dueDate} is null or ${tasks.dueDate} <= ${horizon})`))
        .orderBy(tasks.dueDate, tasks.sortOrder);
      const itemRows = await ctx.db
        .select({ item: commsMomentItems, momentId: commsMoments.id, momentTitle: commsMoments.title, scheduledDate: commsMoments.scheduledDate, scheduledTime: commsMoments.scheduledTime, projectId: projects.id, projectName: projects.name, projectColor: projects.color, ownerName: users.name })
        .from(commsMomentItems)
        .innerJoin(commsMoments, eq(commsMomentItems.momentId, commsMoments.id))
        .innerJoin(commsPlans, eq(commsMoments.planId, commsPlans.id))
        .innerJoin(projects, eq(commsPlans.projectId, projects.id))
        .leftJoin(workspaceMembers, eq(commsMomentItems.ownerMemberId, workspaceMembers.id))
        .leftJoin(users, eq(workspaceMembers.userId, users.id))
        .where(and(eq(projects.workspaceId, ctx.workspace.id), ne(projects.status, "archived"), input.includeDone ? sql`(${commsMomentItems.isDone} = false or ${commsMomentItems.updatedAt} >= ${doneSince})` : eq(commsMomentItems.isDone, false), ne(commsMoments.status, "skipped"), eq(commsMoments.isChecklist, false), memberId ? eq(commsMomentItems.ownerMemberId, memberId) : isNotNull(commsMomentItems.ownerMemberId), memberId ? undefined : sql`${commsMoments.scheduledDate} <= ${horizon}`))
        .orderBy(commsMoments.scheduledDate, commsMoments.sortOrder, commsMomentItems.sortOrder);

      const bucketOf = (date: string | null): "overdue" | "today" | "week" | "later" | "undated" => {
        if (!date) return "undated";
        if (date < today) return "overdue";
        if (date === today) return "today";
        if (date <= weekEnd) return "week";
        return "later";
      };
      const items = [
        ...taskRows.map((r) => ({ kind: "task" as const, id: r.task.id, title: r.task.title, date: r.task.dueDate, time: null as string | null, status: r.task.status, done: r.task.status === "done", phase: r.task.phase, projectId: r.projectId, projectName: r.projectName, projectColor: r.projectColor, momentId: null as string | null, momentTitle: null as string | null, personName: r.assigneeName, bucket: bucketOf(r.task.dueDate) })),
        ...itemRows.map((r) => ({ kind: "item" as const, id: r.item.id, title: r.item.title, date: r.scheduledDate, time: r.scheduledTime, status: null, done: r.item.isDone, phase: null as string | null, projectId: r.projectId, projectName: r.projectName, projectColor: r.projectColor, momentId: r.momentId, momentTitle: r.momentTitle, personName: r.ownerName, bucket: bucketOf(r.scheduledDate) })),
      ].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? ""));
      const open = items.filter((i) => !i.done);
      return { today, memberId, items, counts: { tasks: open.filter((i) => i.kind === "task").length, items: open.filter((i) => i.kind === "item").length, done: items.length - open.length, overdue: open.filter((i) => i.bucket === "overdue").length, today: open.filter((i) => i.bucket === "today").length, week: open.filter((i) => i.bucket === "week").length } };
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
