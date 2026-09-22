import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { Context } from "./context";
import { requireMembership } from "./context";

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/** Any signed-in user. */
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to continue" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Procedures scoped to a workspace: input must carry `workspace` (slug or id). */
export const workspaceProcedure = authedProcedure
  .input(z.object({ workspace: z.string().min(1) }))
  .use(async ({ ctx, input, next }) => {
    const { workspace, member } = await requireMembership(ctx, input.workspace);
    return next({ ctx: { ...ctx, workspace, member } });
  });
