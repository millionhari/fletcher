import { eq } from "drizzle-orm";
import { z } from "zod";
import { ensureSystemTemplates, workspaceMembers, workspaces } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { authedProcedure, router, workspaceProcedure } from "../trpc";
import { PLANS } from "@fletcher/core";
import { isSuperadmin } from "../admin";

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace";
}

export const workspaceRouter = router({
  listMine: authedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name, artistName: workspaces.artistName })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, ctx.user.id));
    return rows;
  }),
  get: workspaceProcedure.query(async ({ ctx }) => ({
    workspace: ctx.workspace,
    member: ctx.member,
    user: { ...ctx.user, isSuperadmin: isSuperadmin(ctx.user.email) },
  })),

  /**
   * Plan changes are a Fletcher-staff action until billing exists, gated by an
   * allow-list of emails so `custom` sizes can be set without touching SQL.
   */
  setPlan: workspaceProcedure
    .input(z.object({ plan: z.enum(PLANS), customQuotaGb: z.number().int().positive().max(100_000).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!isSuperadmin(ctx.user.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Plans are managed by Fletcher for now" });
      const [ws] = await ctx.db.update(workspaces).set({ plan: input.plan, customQuotaGb: input.plan === "custom" ? input.customQuotaGb ?? null : null, updatedAt: new Date() }).where(eq(workspaces.id, ctx.workspace.id)).returning();
      return ws!;
    }),

  /** A new workspace for the caller, who becomes its owner. The first thing a cold sign-up does. */
  create: authedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80), artistName: z.string().trim().min(1).max(80), timezone: z.string().min(1).default("America/Chicago") }))
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.artistName);
      let slug = base;
      for (let i = 2; await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) }); i++) slug = `${base}-${i}`;
      await ensureSystemTemplates(ctx.db);
      const [ws] = await ctx.db.insert(workspaces).values({ slug, name: input.name, artistName: input.artistName, timezone: input.timezone }).returning();
      if (!ws) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ctx.db.insert(workspaceMembers).values({ workspaceId: ws.id, userId: ctx.user.id, role: "manager", permission: "owner" });
      return ws;
    }),
});
