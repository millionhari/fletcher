import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { MOMENT_STATUSES, PLATFORMS } from "@fletcher/core";
import { commsMomentItems, commsMoments, commsPlans, projects, users, workspaceMembers } from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

async function loadPlanForProject(ctx: { db: Db; workspace: { id: string } }, projectId: string) {
  const project = await ctx.db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspace.id)) });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  let plan = await ctx.db.query.commsPlans.findFirst({ where: eq(commsPlans.projectId, project.id) });
  if (!plan) {
    [plan] = await ctx.db.insert(commsPlans).values({ projectId: project.id, name: `${project.name} comms plan` }).returning();
  }
  return { project, plan: plan as typeof commsPlans.$inferSelect };
}

async function loadMoment(ctx: { db: Db; workspace: { id: string } }, momentId: string) {
  const row = await ctx.db
    .select({ moment: commsMoments, workspaceId: projects.workspaceId })
    .from(commsMoments)
    .innerJoin(commsPlans, eq(commsMoments.planId, commsPlans.id))
    .innerJoin(projects, eq(commsPlans.projectId, projects.id))
    .where(eq(commsMoments.id, momentId))
    .then((r) => r[0]);
  if (!row || row.workspaceId !== ctx.workspace.id) throw new TRPCError({ code: "NOT_FOUND" });
  return row.moment as typeof commsMoments.$inferSelect;
}

export interface ItemNode {
  id: string;
  platform: (typeof PLATFORMS)[number];
  title: string;
  ownerMemberId: string | null;
  ownerName: string | null;
  isDone: boolean;
  sortOrder: number;
  children: ItemNode[];
}

function buildTree(rows: { item: typeof commsMomentItems.$inferSelect; ownerName: string | null }[]): ItemNode[] {
  const nodes = new Map<string, ItemNode>();
  for (const r of rows) {
    nodes.set(r.item.id, { id: r.item.id, platform: r.item.platform, title: r.item.title, ownerMemberId: r.item.ownerMemberId, ownerName: r.ownerName, isDone: r.item.isDone, sortOrder: r.item.sortOrder, children: [] });
  }
  const roots: ItemNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.item.id)!;
    const parent = r.item.parentItemId ? nodes.get(r.item.parentItemId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (list: ItemNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export const commsRouter = router({
  getPlan: workspaceProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const { plan, project } = await loadPlanForProject(ctx, input.projectId);
    const moments = await ctx.db.select().from(commsMoments).where(eq(commsMoments.planId, plan.id)).orderBy(commsMoments.sortOrder);
    const momentIds = moments.map((m) => m.id);
    const itemRows = momentIds.length
      ? await ctx.db
          .select({ item: commsMomentItems, ownerName: users.name })
          .from(commsMomentItems)
          .leftJoin(workspaceMembers, eq(commsMomentItems.ownerMemberId, workspaceMembers.id))
          .leftJoin(users, eq(workspaceMembers.userId, users.id))
          .where(inArray(commsMomentItems.momentId, momentIds))
      : [];
    const byMoment = new Map<string, typeof itemRows>();
    for (const r of itemRows) {
      const list = byMoment.get(r.item.momentId) ?? [];
      list.push(r);
      byMoment.set(r.item.momentId, list);
    }
    const countAll = (nodes: ItemNode[]): { total: number; done: number } =>
      nodes.reduce(
        (acc, n) => {
          const c = countAll(n.children);
          return { total: acc.total + 1 + c.total, done: acc.done + (n.isDone ? 1 : 0) + c.done };
        },
        { total: 0, done: 0 },
      );
    return {
      plan,
      project,
      moments: moments.map((m) => {
        const items = buildTree(byMoment.get(m.id) ?? []);
        return { ...m, items, progress: countAll(items) };
      }),
    };
  }),

  updateMoment: workspaceProcedure
    .input(
      z.object({
        momentId: z.string().uuid(),
        title: z.string().min(1).optional(),
        scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        cta: z.string().nullable().optional(),
        copy: z.string().nullable().optional(),
        link: z.string().nullable().optional(),
        assetNote: z.string().nullable().optional(),
        assetDeliverableId: z.string().uuid().nullable().optional(),
        status: z.enum(MOMENT_STATUSES).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const m = await loadMoment(ctx, input.momentId);
      const { momentId, ...rest } = input;
      const [updated] = await ctx.db.update(commsMoments).set({ ...rest, updatedAt: new Date() }).where(eq(commsMoments.id, m.id)).returning();
      return updated!;
    }),

  addMoment: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid(), title: z.string().min(1), scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), scheduledTime: z.string().nullable().optional(), cta: z.string().optional(), isChecklist: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const { plan } = await loadPlanForProject(ctx, input.projectId);
      const existing = await ctx.db.select({ n: commsMoments.sortOrder }).from(commsMoments).where(eq(commsMoments.planId, plan.id));
      const sortOrder = existing.reduce((m, r) => Math.max(m, r.n), -1) + 1;
      const [m] = await ctx.db
        .insert(commsMoments)
        .values({ planId: plan.id, title: input.title, scheduledDate: input.scheduledDate ?? null, scheduledTime: input.scheduledTime ?? null, cta: input.cta ?? null, isChecklist: input.isChecklist, sortOrder, timezone: ctx.workspace.timezone })
        .returning();
      return m!;
    }),

  removeMoment: workspaceProcedure.input(z.object({ momentId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const m = await loadMoment(ctx, input.momentId);
    await ctx.db.delete(commsMoments).where(eq(commsMoments.id, m.id));
    return { ok: true };
  }),

  toggleItem: workspaceProcedure.input(z.object({ itemId: z.string().uuid(), isDone: z.boolean() })).mutation(async ({ ctx, input }) => {
    const item = await ctx.db.query.commsMomentItems.findFirst({ where: eq(commsMomentItems.id, input.itemId) });
    if (!item) throw new TRPCError({ code: "NOT_FOUND" });
    await loadMoment(ctx, item.momentId);
    await ctx.db.update(commsMomentItems).set({ isDone: input.isDone, updatedAt: new Date() }).where(eq(commsMomentItems.id, item.id));
    return { ok: true };
  }),

  addItem: workspaceProcedure
    .input(z.object({ momentId: z.string().uuid(), platform: z.enum(PLATFORMS), title: z.string().min(1), parentItemId: z.string().uuid().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const m = await loadMoment(ctx, input.momentId);
      const siblings = await ctx.db.select({ n: commsMomentItems.sortOrder }).from(commsMomentItems).where(eq(commsMomentItems.momentId, m.id));
      const sortOrder = siblings.reduce((mx, r) => Math.max(mx, r.n), -1) + 1;
      const [item] = await ctx.db.insert(commsMomentItems).values({ momentId: m.id, platform: input.platform, title: input.title, parentItemId: input.parentItemId ?? null, sortOrder }).returning();
      return item!;
    }),

  updateItem: workspaceProcedure
    .input(z.object({ itemId: z.string().uuid(), title: z.string().min(1).optional(), platform: z.enum(PLATFORMS).optional(), ownerMemberId: z.string().uuid().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.commsMomentItems.findFirst({ where: eq(commsMomentItems.id, input.itemId) });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await loadMoment(ctx, item.momentId);
      const { itemId, ...rest } = input;
      const [updated] = await ctx.db.update(commsMomentItems).set({ ...rest, updatedAt: new Date() }).where(eq(commsMomentItems.id, item.id)).returning();
      return updated!;
    }),

  removeItem: workspaceProcedure.input(z.object({ itemId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const item = await ctx.db.query.commsMomentItems.findFirst({ where: eq(commsMomentItems.id, input.itemId) });
    if (!item) throw new TRPCError({ code: "NOT_FOUND" });
    await loadMoment(ctx, item.momentId);
    await ctx.db.delete(commsMomentItems).where(eq(commsMomentItems.parentItemId, item.id));
    await ctx.db.delete(commsMomentItems).where(eq(commsMomentItems.id, item.id));
    return { ok: true };
  }),

  /** Assign every item on a platform (across the whole plan) to one member. */
  assignPlatform: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid(), platform: z.enum(PLATFORMS), ownerMemberId: z.string().uuid().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { plan } = await loadPlanForProject(ctx, input.projectId);
      const moments = await ctx.db.select({ id: commsMoments.id }).from(commsMoments).where(eq(commsMoments.planId, plan.id));
      const ids = moments.map((m) => m.id);
      if (!ids.length) return { updated: 0 };
      const res = await ctx.db
        .update(commsMomentItems)
        .set({ ownerMemberId: input.ownerMemberId, updatedAt: new Date() })
        .where(and(inArray(commsMomentItems.momentId, ids), eq(commsMomentItems.platform, input.platform)))
        .returning({ id: commsMomentItems.id });
      return { updated: res.length };
    }),
});
