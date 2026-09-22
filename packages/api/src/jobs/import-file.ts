import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { checkUploadAllowed, quotaBytesFor } from "@fletcher/core";
import { deliverableVersions, importJobs, taskAttachments, workspaceFiles, workspaces } from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { storage } from "../storage";
import { workspaceUsage } from "../files";
import { resolveSource, SourceNotAccessibleError, type ImportSource } from "./sources";

const MAX_ATTEMPTS = 3;
const STALE_LOCK_MS = 10 * 60 * 1000;

function maxImportBytes(): number {
  return Number(process.env.IMPORT_MAX_BYTES ?? 5 * 1024 ** 3);
}

/** Claim-then-run. Safe to call for a job someone else is running: the claim fails and we return. */
export async function runImportJob(db: Db, jobId: string): Promise<void> {
  const [job] = await db
    .update(importJobs)
    .set({ status: "running", lockedAt: new Date(), attempts: sql`${importJobs.attempts} + 1`, updatedAt: new Date() })
    .where(and(eq(importJobs.id, jobId), or(eq(importJobs.status, "queued"), and(eq(importJobs.status, "running"), lt(importJobs.lockedAt, new Date(Date.now() - STALE_LOCK_MS))))))
    .returning();
  if (!job) return;

  const file = await db.query.workspaceFiles.findFirst({ where: eq(workspaceFiles.id, job.fileId) });
  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, job.workspaceId) });
  if (!file || !workspace) {
    await db.update(importJobs).set({ status: "failed", error: "The file this import belonged to is gone", updatedAt: new Date() }).where(eq(importJobs.id, job.id));
    return;
  }

  const fail = async (message: string, permanent: boolean) => {
    const giveUp = permanent || job.attempts >= MAX_ATTEMPTS;
    await db.update(importJobs).set({ status: giveUp ? "failed" : "queued", lockedAt: null, error: message, updatedAt: new Date() }).where(eq(importJobs.id, job.id));
    if (giveUp) {
      await db.update(workspaceFiles).set({ status: "failed" }).where(eq(workspaceFiles.id, file.id));
      await storage.delete(file.storageKey).catch(() => undefined);
    }
  };

  try {
    const src = await resolveSource(db, job.requestedByUserId, job.source as ImportSource);
    // The reservation used what the picker said; the source is the truth. Same rules as a browser upload.
    const usage = await workspaceUsage(db, workspace);
    const incoming = src.bytes ?? 0;
    const check = checkUploadAllowed({ plan: workspace.plan, usedBytes: usage.usedBytes - file.bytes, quotaBytes: quotaBytesFor(workspace.plan, workspace.customQuotaGb), incomingBytes: incoming, mimeType: src.mimeType, fileName: src.name });
    if (!check.ok) throw new SourceNotAccessibleError(check.message);
    if (incoming > maxImportBytes()) throw new SourceNotAccessibleError(`That file is larger than the ${Math.round(maxImportBytes() / 1024 ** 3)} GB import limit.`);

    await db.update(workspaceFiles).set({ fileName: src.name, mimeType: src.mimeType, bytes: incoming }).where(eq(workspaceFiles.id, file.id));
    await db.update(importJobs).set({ totalBytes: src.bytes, updatedAt: new Date() }).where(eq(importJobs.id, job.id));

    let lastFlush = 0;
    let seen = 0;
    const cap = maxImportBytes();
    const stream = await src.open();
    stream.on("data", (chunk: Buffer) => {
      seen += chunk.length;
      if (seen > cap) stream.destroy(new SourceNotAccessibleError("Import stopped: the file exceeded the size limit."));
    });
    await storage.putStream({
      storageKey: file.storageKey,
      stream,
      mimeType: src.mimeType,
      size: src.bytes,
      onProgress: (bytes) => {
        if (bytes - lastFlush < 2 * 1024 * 1024) return;
        lastFlush = bytes;
        void db.update(importJobs).set({ progressBytes: bytes, updatedAt: new Date() }).where(eq(importJobs.id, job.id));
      },
    });

    const head = await storage.head(file.storageKey);
    const finalBytes = head?.bytes ?? seen;
    await db.update(workspaceFiles).set({ bytes: finalBytes, status: "ready", readyAt: new Date() }).where(eq(workspaceFiles.id, file.id));
    // Versions and attachments carry a denormalized copy of the file facts.
    const facts = { fileName: src.name, mimeType: src.mimeType, bytes: finalBytes };
    await db.update(deliverableVersions).set(facts).where(eq(deliverableVersions.fileId, file.id));
    await db.update(taskAttachments).set({ ...facts, title: src.name }).where(eq(taskAttachments.fileId, file.id));
    await db.update(importJobs).set({ status: "done", progressBytes: finalBytes, totalBytes: finalBytes, lockedAt: null, error: null, updatedAt: new Date() }).where(eq(importJobs.id, job.id));
  } catch (e) {
    const permanent = e instanceof SourceNotAccessibleError;
    await fail(e instanceof Error ? e.message : "Import failed", permanent);
  }
}

/** Cron: anything queued, plus anything that has held its lock too long (a killed function). */
export async function runPendingImports(db: Db, limit = 5): Promise<number> {
  const rows = await db
    .select({ id: importJobs.id })
    .from(importJobs)
    .where(or(eq(importJobs.status, "queued"), and(eq(importJobs.status, "running"), or(isNull(importJobs.lockedAt), lt(importJobs.lockedAt, new Date(Date.now() - STALE_LOCK_MS))))))
    .limit(limit);
  for (const r of rows) await runImportJob(db, r.id);
  return rows.length;
}
