import { eq } from "drizzle-orm";
import { workspaceMembers, workspaces } from "@fletcher/db";
import { publicProcedure, router, workspaceProcedure } from "../trpc";

export const workspaceRouter = router({
  listMine: publicProcedure.query(async ({ ctx }) => {
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
    user: ctx.user,
  })),
});
