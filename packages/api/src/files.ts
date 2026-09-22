import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { checkUploadAllowed, quotaBytesFor, videoUploadsAllowed, type UploadCheck } from "@fletcher/core";
import { deliverableVersions, taskAttachments, users, workspaceFiles, workspaceMembers, workspaces } from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { storage } from "./storage";

type Ctx = { db: Db; workspace: { id: string; plan: string; customQuotaGb: number | null } };

/** Bytes that count toward the quota: real objects plus reservations that haven't been swept yet. */
export async function workspaceUsage(db: Db, workspace: Ctx["workspace"]) {
  const row = await db
    .select({ used: sql<number>`coalesce(sum(${workspaceFiles.bytes}), 0)::bigint` })
    .from(workspaceFiles)
    .where(and(eq(workspaceFiles.workspaceId, workspace.id), inArray(workspaceFiles.status, ["pending", "importing", "ready"])))
    .then((r) => r[0]);
  const usedBytes = Number(row?.used ?? 0);
  const quotaBytes = quotaBytesFor(workspace.plan, workspace.customQuotaGb);
  return { plan: workspace.plan, usedBytes, quotaBytes, overQuota: usedBytes > quotaBytes, videoAllowed: videoUploadsAllowed(workspace.plan) };
}

export async function assertUploadAllowed(ctx: Ctx, file: { bytes: number; mimeType?: string | null; fileName?: string | null }): Promise<void> {
  const usage = await workspaceUsage(ctx.db, ctx.workspace);
  const check: UploadCheck = checkUploadAllowed({ plan: ctx.workspace.plan, usedBytes: usage.usedBytes, quotaBytes: usage.quotaBytes, incomingBytes: file.bytes, mimeType: file.mimeType, fileName: file.fileName });
  if (!check.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: check.message });
}

/** A file row the caller may attach: in this workspace and finished uploading. */
export async function loadReadyFile(ctx: Ctx, fileId: string) {
  const f = await ctx.db.query.workspaceFiles.findFirst({ where: and(eq(workspaceFiles.id, fileId), eq(workspaceFiles.workspaceId, ctx.workspace.id)) });
  if (!f) throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
  if (f.status !== "ready") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "That file hasn't finished uploading" });
  return f;
}

/**
 * The one delete path. Detaches the version / attachment rows that point at
 * the file (comments on a version go with it via cascade), removes the object,
 * then the row.
 */
export async function deleteStoredFile(db: Db, fileId: string): Promise<void> {
  const f = await db.query.workspaceFiles.findFirst({ where: eq(workspaceFiles.id, fileId) });
  if (!f) return;
  await db.delete(deliverableVersions).where(eq(deliverableVersions.fileId, f.id));
  await db.delete(taskAttachments).where(eq(taskAttachments.fileId, f.id));
  await storage.delete(f.storageKey).catch(() => undefined);
  await db.delete(workspaceFiles).where(eq(workspaceFiles.id, f.id));
}

/**
 * Housekeeping run by the cron tick: abandoned reservations, failed imports,
 * and objects whose owning rows were removed by a cascade (project delete)
 * rather than through deleteStoredFile.
 */
export async function sweepStaleFiles(db: Db): Promise<{ removed: number }> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const stale = await db
    .select({ id: workspaceFiles.id })
    .from(workspaceFiles)
    .leftJoin(deliverableVersions, eq(deliverableVersions.fileId, workspaceFiles.id))
    .leftJoin(taskAttachments, eq(taskAttachments.fileId, workspaceFiles.id))
    .where(
      or(
        and(inArray(workspaceFiles.status, ["pending", "failed"]), lt(workspaceFiles.createdAt, twoHoursAgo)),
        and(eq(workspaceFiles.status, "ready"), isNull(deliverableVersions.id), isNull(taskAttachments.id), lt(workspaceFiles.createdAt, oneHourAgo)),
      ),
    );
  const ids = [...new Set(stale.map((s) => s.id))];
  for (const id of ids) await deleteStoredFile(db, id);
  return { removed: ids.length };
}

/** Everything the tick route runs. */
export async function runMaintenance(db: Db) {
  const { runPendingImports } = await import("./jobs/import-file");
  return { sweep: await sweepStaleFiles(db), imports: await runPendingImports(db) };
}

export type WorkspaceRow = typeof workspaces.$inferSelect;

/** For the file route: the row behind a storage key, and whether this email may read it. Legacy seed objects have no row. */
export async function fileAccessFor(db: Db, storageKey: string, email: string): Promise<{ file: typeof workspaceFiles.$inferSelect | null; allowed: boolean }> {
  const file = await db.query.workspaceFiles.findFirst({ where: eq(workspaceFiles.storageKey, storageKey) });
  if (!file) return { file: null, allowed: storageKey.startsWith("seed/") };
  return { file, allowed: await isMemberByEmail(db, file.workspaceId, email) };
}

/** For the local upload route: the pending reservation this email may fill. */
export async function pendingUploadFor(db: Db, fileId: string, email: string) {
  const row = await db.query.workspaceFiles.findFirst({ where: and(eq(workspaceFiles.id, fileId), eq(workspaceFiles.status, "pending")) });
  if (!row) return null;
  return (await isMemberByEmail(db, row.workspaceId, email)) ? row : null;
}

async function isMemberByEmail(db: Db, workspaceId: string, email: string): Promise<boolean> {
  const row = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(users.email, email.toLowerCase())))
    .then((r) => r[0]);
  return !!row;
}
