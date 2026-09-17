import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { timelineTemplateDefSchema } from "@fletcher/core";
import { activityLog, comments, deliverableVersions, deliverables, projects, taskAttachments, taskChecklistItems, tasks, templates, users, workspaceMembers } from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { storage } from "../storage";

export async function loadTaskInWorkspace(ctx: { db: Db; workspace: { id: string } }, taskId: string) {
  const row = await ctx.db
    .select({ task: tasks, project: projects })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .then((r) => r[0]);
  if (!row || row.project.workspaceId !== ctx.workspace.id) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
  return row;
}

async function log(ctx: { db: Db; workspace: { id: string }; member: { id: string } }, task: { id: string; projectId: string }, type: string, payload: Record<string, unknown>) {
  await ctx.db.insert(activityLog).values({ workspaceId: ctx.workspace.id, projectId: task.projectId, taskId: task.id, actorMemberId: ctx.member.id, type, payload });
}

const uploadMeta = z.object({ storageKey: z.string().min(1), fileName: z.string().min(1), mimeType: z.string().min(1), bytes: z.number().int().nonnegative() });

/** Everything the task panel needs in one round trip. */
export const taskDetailRouter = router({
  get: workspaceProcedure.input(z.object({ taskId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const { task, project } = await loadTaskInWorkspace(ctx, input.taskId);
    const assignee = task.assigneeMemberId
      ? await ctx.db.select({ id: workspaceMembers.id, name: users.name, role: workspaceMembers.role }).from(workspaceMembers).innerJoin(users, eq(workspaceMembers.userId, users.id)).where(eq(workspaceMembers.id, task.assigneeMemberId)).then((r) => r[0] ?? null)
      : null;
    const siblings = await ctx.db.select({ id: tasks.id, templateKey: tasks.templateKey, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate, dependsOn: tasks.dependsOn, sortOrder: tasks.sortOrder }).from(tasks).where(eq(tasks.projectId, task.projectId)).orderBy(tasks.dueDate, tasks.sortOrder);
    const byKey = new Map(siblings.filter((s) => s.templateKey).map((s) => [s.templateKey!, s]));
    const dependencies = (task.dependsOn ?? []).map((k) => byKey.get(k)).filter((x): x is NonNullable<typeof x> => !!x);
    const dependents = task.templateKey ? siblings.filter((s) => s.dependsOn?.includes(task.templateKey!)) : [];
    const idx = siblings.findIndex((s) => s.id === task.id);
    const prevTaskId = idx > 0 ? siblings[idx - 1]!.id : null;
    const nextTaskId = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1]!.id : null;

    const template = project.timelineTemplateId ? await ctx.db.query.templates.findFirst({ where: eq(templates.id, project.timelineTemplateId) }) : null;
    const phaseTitle = template ? (timelineTemplateDefSchema.safeParse(template.definition).data?.phases.find((p) => p.key === task.phase)?.title ?? task.phase) : task.phase;

    const checklist = await ctx.db.select().from(taskChecklistItems).where(eq(taskChecklistItems.taskId, task.id)).orderBy(taskChecklistItems.sortOrder, taskChecklistItems.createdAt);
    const attachmentRows = await ctx.db
      .select({ attachment: taskAttachments, deliverable: deliverables, addedByName: users.name })
      .from(taskAttachments)
      .leftJoin(deliverables, eq(taskAttachments.deliverableId, deliverables.id))
      .leftJoin(workspaceMembers, eq(taskAttachments.addedByMemberId, workspaceMembers.id))
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(taskAttachments.taskId, task.id))
      .orderBy(taskAttachments.sortOrder, taskAttachments.createdAt);
    const deliverableIds = attachmentRows.map((r) => r.deliverable?.id).filter((x): x is string => !!x);
    const latestVersions = deliverableIds.length
      ? await ctx.db.select().from(deliverableVersions).where(inArray(deliverableVersions.deliverableId, deliverableIds)).orderBy(desc(deliverableVersions.versionNumber))
      : [];
    const latestByDeliverable = new Map<string, (typeof latestVersions)[number]>();
    for (const v of latestVersions) if (!latestByDeliverable.has(v.deliverableId)) latestByDeliverable.set(v.deliverableId, v);

    const attachments = attachmentRows.map((r) => {
      const v = r.deliverable ? latestByDeliverable.get(r.deliverable.id) ?? null : null;
      return {
        ...r.attachment,
        addedByName: r.addedByName,
        publicUrl: r.attachment.storageKey ? storage.publicUrl(r.attachment.storageKey) : r.attachment.url,
        deliverable: r.deliverable
          ? { id: r.deliverable.id, title: r.deliverable.title, kind: r.deliverable.kind, status: r.deliverable.status, specKey: r.deliverable.specKey, latestVersion: v ? { ...v, publicUrl: v.storageKey ? storage.publicUrl(v.storageKey) : v.url } : null }
          : null,
      };
    });

    const countRow = await ctx.db.select({ count: sql<number>`count(*)::int` }).from(comments).where(and(eq(comments.taskId, task.id), isNull(comments.parentCommentId))).then((r) => r[0]);
    const commentCount = countRow?.count ?? 0;
    const activity = await ctx.db
      .select({ entry: activityLog, actorName: users.name, projectName: projects.name })
      .from(activityLog)
      .leftJoin(workspaceMembers, eq(activityLog.actorMemberId, workspaceMembers.id))
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .leftJoin(projects, eq(activityLog.projectId, projects.id))
      .where(eq(activityLog.taskId, task.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(30);

    return {
      task,
      project: { id: project.id, name: project.name, color: project.color, anchorDate: project.anchorDate, anchorLabel: project.anchorLabel },
      phaseTitle,
      assignee,
      dependencies,
      dependents,
      prevTaskId,
      nextTaskId,
      checklist,
      attachments,
      commentCount,
      activity: activity.map((r) => ({ ...r.entry, actorName: r.actorName, projectName: r.projectName })),
    };
  }),

  saveDoc: workspaceProcedure
    .input(z.object({ taskId: z.string().uuid(), doc: z.unknown(), docText: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { task } = await loadTaskInWorkspace(ctx, input.taskId);
      const now = new Date();
      await ctx.db.update(tasks).set({ doc: input.doc as object, docText: input.docText.slice(0, 500), docUpdatedAt: now, updatedAt: now }).where(eq(tasks.id, task.id));
      return { savedAt: now };
    }),

  rename: workspaceProcedure.input(z.object({ taskId: z.string().uuid(), title: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const { task } = await loadTaskInWorkspace(ctx, input.taskId);
    await ctx.db.update(tasks).set({ title: input.title.trim(), updatedAt: new Date() }).where(eq(tasks.id, task.id));
    await log(ctx, task, "task.renamed", { from: task.title, to: input.title.trim() });
    return { ok: true };
  }),

  // Checklist
  addChecklistItem: workspaceProcedure.input(z.object({ taskId: z.string().uuid(), title: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const { task } = await loadTaskInWorkspace(ctx, input.taskId);
    const maxRow = await ctx.db.select({ max: sql<number>`coalesce(max(${taskChecklistItems.sortOrder}), -1)::int` }).from(taskChecklistItems).where(eq(taskChecklistItems.taskId, task.id)).then((r) => r[0]);
    const [item] = await ctx.db.insert(taskChecklistItems).values({ taskId: task.id, title: input.title.trim(), sortOrder: (maxRow?.max ?? -1) + 1 }).returning();
    return item!;
  }),
  updateChecklistItem: workspaceProcedure
    .input(z.object({ itemId: z.string().uuid(), title: z.string().min(1).optional(), isDone: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.taskChecklistItems.findFirst({ where: eq(taskChecklistItems.id, input.itemId) });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      const { task } = await loadTaskInWorkspace(ctx, item.taskId);
      const [updated] = await ctx.db.update(taskChecklistItems).set({ title: input.title?.trim() ?? item.title, isDone: input.isDone ?? item.isDone, updatedAt: new Date() }).where(eq(taskChecklistItems.id, item.id)).returning();
      if (input.isDone !== undefined && input.isDone !== item.isDone) await log(ctx, task, "task.checklist", { title: item.title, done: input.isDone });
      return updated!;
    }),
  removeChecklistItem: workspaceProcedure.input(z.object({ itemId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const item = await ctx.db.query.taskChecklistItems.findFirst({ where: eq(taskChecklistItems.id, input.itemId) });
    if (!item) throw new TRPCError({ code: "NOT_FOUND" });
    await loadTaskInWorkspace(ctx, item.taskId);
    await ctx.db.delete(taskChecklistItems).where(eq(taskChecklistItems.id, item.id));
    return { ok: true };
  }),
  reorderChecklist: workspaceProcedure.input(z.object({ taskId: z.string().uuid(), itemIds: z.array(z.string().uuid()) })).mutation(async ({ ctx, input }) => {
    const { task } = await loadTaskInWorkspace(ctx, input.taskId);
    for (let i = 0; i < input.itemIds.length; i++) {
      await ctx.db.update(taskChecklistItems).set({ sortOrder: i }).where(and(eq(taskChecklistItems.id, input.itemIds[i]!), eq(taskChecklistItems.taskId, task.id)));
    }
    return { ok: true };
  }),

  // Attachments
  candidates: workspaceProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({ id: deliverables.id, title: deliverables.title, kind: deliverables.kind, status: deliverables.status, specKey: deliverables.specKey, assetScope: deliverables.assetScope, projectId: deliverables.projectId })
      .from(deliverables)
      .where(and(eq(deliverables.workspaceId, ctx.workspace.id), sql`(${deliverables.projectId} = ${input.projectId} or ${deliverables.projectId} is null)`))
      .orderBy(deliverables.title);
    return rows.map((r) => ({ ...r, group: r.projectId ? (r.assetScope ? (r.assetScope === "prerelease" ? "Pre-release set" : "Release set") : "Project deliverables") : "Profile kit" }));
  }),
  attachDeliverable: workspaceProcedure.input(z.object({ taskId: z.string().uuid(), deliverableId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { task } = await loadTaskInWorkspace(ctx, input.taskId);
    const d = await ctx.db.query.deliverables.findFirst({ where: and(eq(deliverables.id, input.deliverableId), eq(deliverables.workspaceId, ctx.workspace.id)) });
    if (!d) throw new TRPCError({ code: "NOT_FOUND" });
    const existing = await ctx.db.query.taskAttachments.findFirst({ where: and(eq(taskAttachments.taskId, task.id), eq(taskAttachments.deliverableId, d.id)) });
    if (existing) return existing;
    const [a] = await ctx.db.insert(taskAttachments).values({ taskId: task.id, kind: "deliverable", deliverableId: d.id, title: d.title, addedByMemberId: ctx.member.id, sortOrder: 999 }).returning();
    await log(ctx, task, "task.attachment", { title: d.title, kind: "deliverable" });
    return a!;
  }),
  attachLink: workspaceProcedure.input(z.object({ taskId: z.string().uuid(), url: z.string().url(), title: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const { task } = await loadTaskInWorkspace(ctx, input.taskId);
    const title = input.title?.trim() || new URL(input.url).hostname.replace(/^www\./, "");
    const [a] = await ctx.db.insert(taskAttachments).values({ taskId: task.id, kind: "link", url: input.url, title, addedByMemberId: ctx.member.id, sortOrder: 999 }).returning();
    await log(ctx, task, "task.attachment", { title, kind: "link" });
    return a!;
  }),
  attachFile: workspaceProcedure.input(z.object({ taskId: z.string().uuid(), upload: uploadMeta })).mutation(async ({ ctx, input }) => {
    const { task } = await loadTaskInWorkspace(ctx, input.taskId);
    const [a] = await ctx.db.insert(taskAttachments).values({ taskId: task.id, kind: "file", title: input.upload.fileName, storageKey: input.upload.storageKey, fileName: input.upload.fileName, mimeType: input.upload.mimeType, bytes: input.upload.bytes, addedByMemberId: ctx.member.id, sortOrder: 999 }).returning();
    await log(ctx, task, "task.attachment", { title: input.upload.fileName, kind: "file" });
    return a!;
  }),
  /** Create a brand-new deliverable on the task's project and attach it (also becomes the primary review deliverable if none). */
  createAndAttachDeliverable: workspaceProcedure
    .input(z.object({ taskId: z.string().uuid(), title: z.string().min(1), kind: z.enum(["video", "image", "audio", "document", "link"]) }))
    .mutation(async ({ ctx, input }) => {
      const { task } = await loadTaskInWorkspace(ctx, input.taskId);
      const [d] = await ctx.db.insert(deliverables).values({ workspaceId: ctx.workspace.id, projectId: task.projectId, kind: input.kind, title: input.title.trim() }).returning();
      await ctx.db.insert(taskAttachments).values({ taskId: task.id, kind: "deliverable", deliverableId: d!.id, title: d!.title, addedByMemberId: ctx.member.id, sortOrder: 999 });
      if (!task.deliverableId) await ctx.db.update(tasks).set({ deliverableId: d!.id }).where(eq(tasks.id, task.id));
      await log(ctx, task, "task.attachment", { title: d!.title, kind: "deliverable" });
      return d!;
    }),
  removeAttachment: workspaceProcedure.input(z.object({ attachmentId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const a = await ctx.db.query.taskAttachments.findFirst({ where: eq(taskAttachments.id, input.attachmentId) });
    if (!a) throw new TRPCError({ code: "NOT_FOUND" });
    await loadTaskInWorkspace(ctx, a.taskId);
    if (a.kind === "file" && a.storageKey) await storage.delete(a.storageKey).catch(() => undefined);
    await ctx.db.delete(taskAttachments).where(eq(taskAttachments.id, a.id));
    return { ok: true };
  }),
});
