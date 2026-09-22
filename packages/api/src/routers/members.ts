import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { MEMBER_ROLES, PERMISSIONS, todayISO } from "@fletcher/core";
import { projects, tasks, users, workspaceMembers } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { requirePermission } from "../context";
import { inviteByEmail, supabaseConfigured } from "../auth/admin";

const MANAGE = ["owner", "admin"] as const;

/** Where an invite lands: the auth callback, which then drops them into the workspace. */
function inviteRedirect(slug: string): string {
  const app = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${app}/auth/callback?next=${encodeURIComponent(`/w/${slug}`)}`;
}

/**
 * Send the invite when Supabase is wired up; in local dev without it the row
 * simply exists and the person appears once they sign in with that email.
 */
async function sendInvite(email: string, slug: string, workspaceName: string): Promise<"sent" | "already_registered" | "skipped"> {
  if (!supabaseConfigured()) return "skipped";
  return inviteByEmail(email, inviteRedirect(slug), { workspace: workspaceName });
}

export const membersRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: workspaceMembers.id,
        role: workspaceMembers.role,
        permission: workspaceMembers.permission,
        title: workspaceMembers.title,
        company: workspaceMembers.company,
        isExternal: workspaceMembers.isExternal,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        authId: users.authId,
        invitedAt: users.invitedAt,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, ctx.workspace.id))
      .orderBy(users.name);
    // Open workload per member across live projects, for the hover card on an assignee.
    const today = todayISO();
    const load = await ctx.db
      .select({
        memberId: tasks.assigneeMemberId,
        open: sql<number>`count(*)::int`,
        overdue: sql<number>`sum(case when ${tasks.dueDate} < ${today} then 1 else 0 end)::int`,
        nextDue: sql<string | null>`min(case when ${tasks.dueDate} >= ${today} then ${tasks.dueDate} end)`,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(projects.workspaceId, ctx.workspace.id), ne(projects.status, "archived"), ne(tasks.status, "done")))
      .groupBy(tasks.assigneeMemberId);
    const byMember = new Map(load.map((l) => [l.memberId, l]));
    return rows.map((r) => {
      const l = byMember.get(r.id);
      return { ...r, openTasks: l?.open ?? 0, overdueTasks: l?.overdue ?? 0, nextDueDate: l?.nextDue ?? null };
    });
  }),

  add: workspaceProcedure
    .input(
      z.object({
        name: z.string().trim().optional(),
        email: z.string().email(),
        role: z.enum(MEMBER_ROLES),
        permission: z.enum(PERMISSIONS).default("member"),
        title: z.string().optional(),
        company: z.string().optional(),
        isExternal: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requirePermission(ctx.member, MANAGE);
      const email = input.email.toLowerCase();
      // Name is a placeholder until they sign in and we learn it from their account.
      const name = input.name || email.split("@")[0]!;
      const [user] = await ctx.db
        .insert(users)
        .values({ email, name })
        .onConflictDoUpdate({ target: users.email, set: input.name ? { name: input.name } : { updatedAt: new Date() } })
        .returning();
      const existing = await ctx.db.query.workspaceMembers.findFirst({
        where: and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(workspaceMembers.userId, user!.id)),
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Already a member" });
      const [member] = await ctx.db
        .insert(workspaceMembers)
        .values({
          workspaceId: ctx.workspace.id,
          userId: user!.id,
          role: input.role,
          permission: input.permission,
          title: input.title,
          company: input.company,
          isExternal: input.isExternal,
        })
        .returning();
      // Someone who already has an account just signs in; the membership is waiting.
      if (!user!.authId) {
        const outcome = await sendInvite(email, ctx.workspace.slug, ctx.workspace.name);
        if (outcome === "sent") await ctx.db.update(users).set({ invitedAt: new Date() }).where(eq(users.id, user!.id));
      }
      return member!;
    }),

  resendInvite: workspaceProcedure.input(z.object({ memberId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    requirePermission(ctx.member, MANAGE);
    const row = await ctx.db
      .select({ email: users.email, authId: users.authId, userId: users.id })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(and(eq(workspaceMembers.id, input.memberId), eq(workspaceMembers.workspaceId, ctx.workspace.id)))
      .then((r) => r[0]);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    if (row.authId) throw new TRPCError({ code: "BAD_REQUEST", message: "They already have an account — ask them to sign in." });
    const outcome = await sendInvite(row.email, ctx.workspace.slug, ctx.workspace.name);
    if (outcome === "skipped") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Email invites aren't configured in this environment." });
    await ctx.db.update(users).set({ invitedAt: new Date() }).where(eq(users.id, row.userId));
    return { outcome };
  }),

  update: workspaceProcedure
    .input(
      z.object({
        memberId: z.string().uuid(),
        role: z.enum(MEMBER_ROLES).optional(),
        permission: z.enum(PERMISSIONS).optional(),
        title: z.string().nullable().optional(),
        company: z.string().nullable().optional(),
        isExternal: z.boolean().optional(),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { memberId, name, ...rest } = input;
      // Anyone may fix their own title/company/name; changing roles or permissions is a manager's job.
      if (memberId !== ctx.member.id || rest.role !== undefined || rest.permission !== undefined) requirePermission(ctx.member, MANAGE);
      const [member] = await ctx.db
        .update(workspaceMembers)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, ctx.workspace.id)))
        .returning();
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      if (name) await ctx.db.update(users).set({ name }).where(eq(users.id, member.userId));
      return member;
    }),

  remove: workspaceProcedure.input(z.object({ memberId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    requirePermission(ctx.member, MANAGE);
    if (input.memberId === ctx.member.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself" });
    await ctx.db
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.id, input.memberId), eq(workspaceMembers.workspaceId, ctx.workspace.id)));
    return { ok: true };
  }),
});
