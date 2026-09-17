import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { MEMBER_ROLES, PERMISSIONS } from "@fletcher/core";
import { users, workspaceMembers } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

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
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, ctx.workspace.id))
      .orderBy(users.name);
    return rows;
  }),

  add: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(MEMBER_ROLES),
        permission: z.enum(PERMISSIONS).default("member"),
        title: z.string().optional(),
        company: z.string().optional(),
        isExternal: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .insert(users)
        .values({ email: input.email.toLowerCase(), name: input.name })
        .onConflictDoUpdate({ target: users.email, set: { name: input.name } })
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
      return member!;
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
    if (input.memberId === ctx.member.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself" });
    await ctx.db
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.id, input.memberId), eq(workspaceMembers.workspaceId, ctx.workspace.id)));
    return { ok: true };
  }),
});
