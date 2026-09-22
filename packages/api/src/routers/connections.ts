import { eq } from "drizzle-orm";
import { z } from "zod";
import { userConnections } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { authedProcedure, router } from "../trpc";
import { disconnect, getValidAccessToken, PROVIDERS, providerConfigured, type Provider } from "../connections";

const provider = z.enum(["google_drive", "box"]);

/** Everything here is per person: their own cloud accounts, nobody else's. */
export const connectionsRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.userConnections.findMany({ where: eq(userConnections.userId, ctx.user.id) });
    return (Object.keys(PROVIDERS) as Provider[]).map((p) => {
      const row = rows.find((r) => r.provider === p);
      return { provider: p, label: PROVIDERS[p].label, configured: providerConfigured(p), connected: !!row, accountLabel: row?.accountLabel ?? null, connectedAt: row?.createdAt ?? null };
    });
  }),

  disconnect: authedProcedure.input(z.object({ provider })).mutation(async ({ ctx, input }) => {
    await disconnect(ctx.db, ctx.user.id, input.provider);
    return { ok: true };
  }),

  /** A short-lived access token for the provider's own picker UI; never the refresh token. */
  pickerToken: authedProcedure.input(z.object({ provider })).mutation(async ({ ctx, input }) => {
    const accessToken = await getValidAccessToken(ctx.db, ctx.user.id, input.provider);
    return { accessToken };
  }),

  /** Box has no drop-in picker we can use, so the folder browser is ours and this feeds it. */
  boxList: authedProcedure.input(z.object({ folderId: z.string().default("0"), offset: z.number().int().nonnegative().default(0) })).query(async ({ ctx, input }) => {
    const token = await getValidAccessToken(ctx.db, ctx.user.id, "box");
    const res = await fetch(`https://api.box.com/2.0/folders/${encodeURIComponent(input.folderId)}/items?fields=id,type,name,size,modified_at&limit=100&offset=${input.offset}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: `Box returned ${res.status}` });
    const j = (await res.json()) as { entries: { id: string; type: "file" | "folder" | "web_link"; name: string; size?: number; modified_at?: string }[]; total_count: number };
    return { entries: j.entries.filter((e) => e.type !== "web_link"), total: j.total_count };
  }),
});
