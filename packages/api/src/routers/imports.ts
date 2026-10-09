import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { parseCloudLink } from "@fletcher/core";
import { activityLog, deliverableVersions, deliverables, importJobs, projects, taskAttachments, tasks, workspaceFiles } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { newStorageKey } from "../storage";
import { assertUploadAllowed } from "../files";
import { runImportJob } from "../jobs/import-file";
import type { ImportSource } from "../jobs/sources";

const target = z.union([z.object({ deliverableId: z.string().uuid(), note: z.string().optional() }), z.object({ taskId: z.string().uuid() })]);
type Target = z.infer<typeof target>;

const fileHint = z.object({ name: z.string().min(1).max(255), mimeType: z.string().max(200).optional(), bytes: z.number().int().nonnegative().optional() });

type Ctx = Parameters<Parameters<typeof workspaceProcedure.mutation>[0]>[0]["ctx"];

/**
 * Create the placeholder file + version/attachment + job in one go, then kick
 * the job. The caller sees a version in "importing" state immediately.
 */
async function startImport(ctx: Ctx, t: Target, source: ImportSource, hint: { name: string; mimeType?: string; bytes?: number }, origin: "google_drive" | "dropbox" | "box" | "share_link", originUrl: string | null) {
  await assertUploadAllowed(ctx, { bytes: hint.bytes ?? 0, mimeType: hint.mimeType, fileName: hint.name });

  let folder: string;
  let projectId: string | null;
  if ("deliverableId" in t) {
    const d = await ctx.db.query.deliverables.findFirst({ where: and(eq(deliverables.id, t.deliverableId), eq(deliverables.workspaceId, ctx.workspace.id)) });
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Deliverable not found" });
    folder = `deliverables/${d.id}`;
    projectId = d.projectId;
  } else {
    const row = await ctx.db.select({ task: tasks, workspaceId: projects.workspaceId }).from(tasks).innerJoin(projects, eq(tasks.projectId, projects.id)).where(eq(tasks.id, t.taskId)).then((r) => r[0]);
    if (!row || row.workspaceId !== ctx.workspace.id) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
    folder = `tasks/${row.task.id}`;
    projectId = row.task.projectId;
  }

  const [file] = await ctx.db
    .insert(workspaceFiles)
    .values({ workspaceId: ctx.workspace.id, storageKey: newStorageKey(`ws/${ctx.workspace.id}/${folder}`, hint.name), fileName: hint.name, mimeType: hint.mimeType ?? "application/octet-stream", bytes: hint.bytes ?? 0, status: "importing", origin, originUrl, uploadedByMemberId: ctx.member.id })
    .returning();

  let versionId: string | null = null;
  let attachmentId: string | null = null;
  if ("deliverableId" in t) {
    const [latest] = await ctx.db.select({ n: deliverableVersions.versionNumber }).from(deliverableVersions).where(eq(deliverableVersions.deliverableId, t.deliverableId)).orderBy(desc(deliverableVersions.versionNumber)).limit(1);
    const versionNumber = (latest?.n ?? 0) + 1;
    const [v] = await ctx.db
      .insert(deliverableVersions)
      .values({ deliverableId: t.deliverableId, versionNumber, sourceType: "upload", fileId: file!.id, storageKey: file!.storageKey, fileName: hint.name, mimeType: hint.mimeType ?? null, bytes: hint.bytes ?? null, note: t.note ?? null, uploadedByMemberId: ctx.member.id })
      .returning();
    versionId = v!.id;
    await ctx.db.update(deliverables).set({ status: "in_review", updatedAt: new Date() }).where(and(eq(deliverables.id, t.deliverableId), eq(deliverables.status, "draft")));
    await ctx.db.insert(activityLog).values({ workspaceId: ctx.workspace.id, projectId, actorMemberId: ctx.member.id, type: "version.added", payload: { title: hint.name, version: versionNumber, importing: true, deliverableId: t.deliverableId } });
  } else {
    const [a] = await ctx.db
      .insert(taskAttachments)
      .values({ taskId: t.taskId, kind: "file", title: hint.name, fileId: file!.id, storageKey: file!.storageKey, fileName: hint.name, mimeType: hint.mimeType ?? null, bytes: hint.bytes ?? null, addedByMemberId: ctx.member.id, sortOrder: 999 })
      .returning();
    attachmentId = a!.id;
  }

  const [job] = await ctx.db
    .insert(importJobs)
    .values({ workspaceId: ctx.workspace.id, fileId: file!.id, requestedByMemberId: ctx.member.id, requestedByUserId: ctx.user.id, source, totalBytes: hint.bytes ?? null })
    .returning();
  ctx.enqueue(() => runImportJob(ctx.db, job!.id));
  return { jobId: job!.id, fileId: file!.id, versionId, attachmentId };
}

export const importsRouter = router({
  /** A file picked in a provider's picker (Google Picker, Dropbox Chooser, our Box browser). */
  fromProvider: workspaceProcedure
    .input(z.object({
      target,
      provider: z.enum(["google_drive", "box", "dropbox_chooser"]),
      file: z.object({ id: z.string().optional(), link: z.string().url().optional() }).and(fileHint),
    }))
    .mutation(async ({ ctx, input }) => {
      const f = input.file;
      let source: ImportSource;
      let origin: "google_drive" | "dropbox" | "box";
      if (input.provider === "dropbox_chooser") {
        if (!f.link) throw new TRPCError({ code: "BAD_REQUEST", message: "Dropbox pick is missing its link" });
        source = { kind: "dropbox_chooser", link: f.link, name: f.name, bytes: f.bytes };
        origin = "dropbox";
      } else {
        if (!f.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick is missing its file id" });
        source = { kind: input.provider, fileId: f.id, name: f.name, mimeType: f.mimeType, bytes: f.bytes };
        origin = input.provider;
      }
      return startImport(ctx, input.target, source, f, origin, f.link ?? null);
    }),

  /** A pasted Drive / Dropbox / Box share link. */
  fromLink: workspaceProcedure
    .input(z.object({ target, url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const cloud = parseCloudLink(input.url);
      if (!cloud) throw new TRPCError({ code: "BAD_REQUEST", message: "That isn't a Drive, Dropbox or Box file link" });
      const name = guessNameFromLink(input.url) ?? "file";
      return startImport(ctx, input.target, { kind: "share_link", provider: cloud.provider, url: cloud.url, id: cloud.id }, { name }, "share_link", input.url);
    }),

  status: workspaceProcedure.input(z.object({ jobId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const j = await ctx.db.query.importJobs.findFirst({ where: and(eq(importJobs.id, input.jobId), eq(importJobs.workspaceId, ctx.workspace.id)) });
    if (!j) throw new TRPCError({ code: "NOT_FOUND" });
    return { status: j.status, progressBytes: j.progressBytes, totalBytes: j.totalBytes, error: j.error };
  }),

  retry: workspaceProcedure.input(z.object({ fileId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const j = await ctx.db.query.importJobs.findFirst({ where: and(eq(importJobs.fileId, input.fileId), eq(importJobs.workspaceId, ctx.workspace.id)), orderBy: desc(importJobs.createdAt) });
    if (!j) throw new TRPCError({ code: "NOT_FOUND" });
    await ctx.db.update(importJobs).set({ status: "queued", attempts: 0, error: null, lockedAt: null, updatedAt: new Date() }).where(eq(importJobs.id, j.id));
    await ctx.db.update(workspaceFiles).set({ status: "importing" }).where(eq(workspaceFiles.id, j.fileId));
    ctx.enqueue(() => runImportJob(ctx.db, j.id));
    return { jobId: j.id };
  }),
});

/** Dropbox and Box links usually carry the file name in the path; Drive links don't. */
function guessNameFromLink(url: string): string | null {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
    return /\.[a-z0-9]{2,5}$/i.test(last) ? last : null;
  } catch {
    return null;
  }
}
