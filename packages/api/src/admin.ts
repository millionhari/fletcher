import { TRPCError } from "@trpc/server";
import { authedProcedure } from "./trpc";

/** Fletcher staff: the comma-separated allow-list in FLETCHER_SUPERADMIN_EMAILS. */
export function isSuperadmin(email: string): boolean {
  return (process.env.FLETCHER_SUPERADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

export const superadminProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (!isSuperadmin(ctx.user.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  return next({ ctx });
});
