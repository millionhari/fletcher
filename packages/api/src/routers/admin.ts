import { desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { PLANS, quotaBytesFor } from "@fletcher/core";
import { projects, users, workspaceFiles, workspaceMembers, workspaces } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { superadminProcedure } from "../admin";

/**
 * The staff view: every workspace, who runs it, what it holds, and the plan
 * it's on. Plan changes happen here until billing exists.
 */
export const adminRouter = router({
  overview: superadminProcedure.query(async ({ ctx }) => {
    const ws = await ctx.db.select().from(workspaces).orderBy(desc(workspaces.createdAt));
    const ids = ws.map((w) => w.id);
    if (!ids.length) return { workspaces: [], users: [] };

    const members = await ctx.db
      .select({ workspaceId: workspaceMembers.workspaceId, memberId: workspaceMembers.id, permission: workspaceMembers.permission, role: workspaceMembers.role, userId: users.id, email: users.email, name: users.name, authId: users.authId, invitedAt: users.invitedAt, createdAt: users.createdAt })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(inArray(workspaceMembers.workspaceId, ids));
    const projectRows = await ctx.db
      .select({ id: projects.id, workspaceId: projects.workspaceId, name: projects.name, type: projects.type, status: projects.status, anchorDate: projects.anchorDate, createdAt: projects.createdAt })
      .from(projects)
      .where(inArray(projects.workspaceId, ids))
      .orderBy(desc(projects.createdAt));
    const usage = await ctx.db
      .select({ workspaceId: workspaceFiles.workspaceId, used: sql<number>`coalesce(sum(${workspaceFiles.bytes}), 0)::bigint`, files: sql<number>`count(*)::int` })
      .from(workspaceFiles)
      .where(inArray(workspaceFiles.status, ["pending", "importing", "ready"]))
      .groupBy(workspaceFiles.workspaceId);
    const usageBy = new Map(usage.map((u) => [u.workspaceId, u]));

    const workspaceList = ws.map((w) => {
      const ms = members.filter((m) => m.workspaceId === w.id);
      const owner = ms.find((m) => m.permission === "owner") ?? ms[0] ?? null;
      const u = usageBy.get(w.id);
      return {
        id: w.id,
        slug: w.slug,
        name: w.name,
        artistName: w.artistName,
        plan: w.plan,
        customQuotaGb: w.customQuotaGb,
        quotaBytes: quotaBytesFor(w.plan, w.customQuotaGb),
        usedBytes: Number(u?.used ?? 0),
        fileCount: u?.files ?? 0,
        createdAt: w.createdAt,
        owner: owner ? { email: owner.email, name: owner.name } : null,
        members: ms.map((m) => ({ id: m.memberId, email: m.email, name: m.name, permission: m.permission, role: m.role, active: !!m.authId })),
        projects: projectRows.filter((p) => p.workspaceId === w.id).map(({ workspaceId: _w, ...p }) => p),
      };
    });

    // People, with everything they belong to.
    const allUsers = await ctx.db.select().from(users).orderBy(desc(users.createdAt));
    const userList = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      active: !!u.authId,
      invitedAt: u.invitedAt,
      createdAt: u.createdAt,
      workspaces: members.filter((m) => m.userId === u.id).map((m) => { const w = ws.find((x) => x.id === m.workspaceId)!; return { id: w.id, slug: w.slug, name: w.name, permission: m.permission }; }),
    }));

    return { workspaces: workspaceList, users: userList };
  }),

  setPlan: superadminProcedure
    .input(z.object({ workspaceId: z.string().uuid(), plan: z.enum(PLANS), customQuotaGb: z.number().int().positive().max(100_000).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.plan === "custom" && !input.customQuotaGb) throw new TRPCError({ code: "BAD_REQUEST", message: "Custom plans need a size in GB" });
      const [row] = await ctx.db
        .update(workspaces)
        .set({ plan: input.plan, customQuotaGb: input.plan === "custom" ? input.customQuotaGb ?? null : null, updatedAt: new Date() })
        .where(eq(workspaces.id, input.workspaceId))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),
});
