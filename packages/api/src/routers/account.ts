import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "@fletcher/db";
import { authedProcedure, router } from "../trpc";

/** The signed-in person, independent of any workspace. */
export const accountRouter = router({
  me: authedProcedure.query(({ ctx }) => ctx.user),

  updateProfile: authedProcedure.input(z.object({ name: z.string().trim().min(1).max(80) })).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.update(users).set({ name: input.name, updatedAt: new Date() }).where(eq(users.id, ctx.user.id)).returning();
    return row!;
  }),
});
