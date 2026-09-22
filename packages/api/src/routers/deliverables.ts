import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  ASSET_SPEC_BY_KEY,
  checkAgainstSpec,
  DELIVERABLE_KINDS,
  DELIVERABLE_STATUSES,
  parseVideoLink,
  specsForScope,
} from "@fletcher/core";
import { activityLog, deliverableVersions, deliverables, importJobs, projects, tasks, users, workspaceFiles, workspaceMembers } from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { storage } from "../storage";
import { deleteStoredFile, loadReadyFile } from "../files";

async function loadDeliverable(ctx: { db: Db; workspace: { id: string } }, id: string) {
  const row = await ctx.db.query.deliverables.findFirst({ where: and(eq(deliverables.id, id), eq(deliverables.workspaceId, ctx.workspace.id)) });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Deliverable not found" });
  return row as typeof deliverables.$inferSelect;
}

/** A finished upload, by its workspace_files row. Every size/type field comes from the server, not the client. */
const uploadMeta = z.object({ fileId: z.string().uuid() });

export const deliverablesRouter = router({
  get: workspaceProcedure.input(z.object({ deliverableId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const d = await loadDeliverable(ctx, input.deliverableId);
    const versions = await ctx.db
      .select({ version: deliverableVersions, uploaderName: users.name })
      .from(deliverableVersions)
      .leftJoin(workspaceMembers, eq(deliverableVersions.uploadedByMemberId, workspaceMembers.id))
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(deliverableVersions.deliverableId, d.id))
      .orderBy(desc(deliverableVersions.versionNumber));
    // Import progress for versions still being copied in.
    const fileIds = versions.map((v) => v.version.fileId).filter((x): x is string => !!x);
    const fileRows = fileIds.length ? await ctx.db.select({ id: workspaceFiles.id, status: workspaceFiles.status }).from(workspaceFiles).where(inArray(workspaceFiles.id, fileIds)) : [];
    const jobRows = fileIds.length ? await ctx.db.select({ fileId: importJobs.fileId, progressBytes: importJobs.progressBytes, totalBytes: importJobs.totalBytes, error: importJobs.error, status: importJobs.status }).from(importJobs).where(inArray(importJobs.fileId, fileIds)).orderBy(desc(importJobs.createdAt)) : [];
    const fileById = new Map(fileRows.map((f) => [f.id, f]));
    const jobByFile = new Map<string, (typeof jobRows)[number]>();
    for (const j of jobRows) if (!jobByFile.has(j.fileId)) jobByFile.set(j.fileId, j);
    const project = d.projectId ? await ctx.db.query.projects.findFirst({ where: eq(projects.id, d.projectId) }) : null;
    const task = await ctx.db.query.tasks.findFirst({ where: eq(tasks.deliverableId, d.id) });
    const spec = d.specKey ? ASSET_SPEC_BY_KEY[d.specKey] ?? null : null;
    return {
      deliverable: d,
      project,
      task,
      spec,
      versions: versions.map((v) => ({
        ...v.version,
        uploaderName: v.uploaderName,
        publicUrl: v.version.storageKey ? storage.publicUrl(v.version.storageKey) : v.version.url,
        file: v.version.fileId ? { status: fileById.get(v.version.fileId)?.status ?? "ready", progressBytes: jobByFile.get(v.version.fileId)?.progressBytes ?? 0, totalBytes: jobByFile.get(v.version.fileId)?.totalBytes ?? null, error: jobByFile.get(v.version.fileId)?.error ?? null } : null,
        specCheck: spec ? checkAgainstSpec(spec, { width: v.version.width, height: v.version.height, bytes: v.version.bytes, durationSeconds: v.version.durationSeconds }) : null,
      })),
    };
  }),

  listByProject: workspaceProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const rows = await ctx.db.query.deliverables.findMany({
      where: and(eq(deliverables.projectId, input.projectId), eq(deliverables.workspaceId, ctx.workspace.id)),
      with: { versions: { orderBy: [desc(deliverableVersions.versionNumber)], limit: 1 } },
      orderBy: [deliverables.createdAt],
    });
    return rows.map((d) => ({ ...d, latestVersion: d.versions[0] ?? null }));
  }),

  create: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid().nullable().optional(), kind: z.enum(DELIVERABLE_KINDS), title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [d] = await ctx.db
        .insert(deliverables)
        .values({ workspaceId: ctx.workspace.id, projectId: input.projectId ?? null, kind: input.kind, title: input.title, description: input.description ?? null })
        .returning();
      return d!;
    }),

  update: workspaceProcedure
    .input(z.object({ deliverableId: z.string().uuid(), title: z.string().min(1).optional(), description: z.string().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const d = await loadDeliverable(ctx, input.deliverableId);
      const [updated] = await ctx.db.update(deliverables).set({ title: input.title ?? d.title, description: input.description === undefined ? d.description : input.description, updatedAt: new Date() }).where(eq(deliverables.id, d.id)).returning();
      return updated!;
    }),

  setStatus: workspaceProcedure
    .input(z.object({ deliverableId: z.string().uuid(), status: z.enum(DELIVERABLE_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const d = await loadDeliverable(ctx, input.deliverableId);
      const [updated] = await ctx.db.update(deliverables).set({ status: input.status, updatedAt: new Date() }).where(eq(deliverables.id, d.id)).returning();
      if (input.status === "approved") {
        await ctx.db.update(tasks).set({ status: "done", updatedAt: new Date() }).where(eq(tasks.deliverableId, d.id));
      } else if (input.status === "in_review") {
        await ctx.db.update(tasks).set({ status: "in_review", updatedAt: new Date() }).where(and(eq(tasks.deliverableId, d.id), eq(tasks.status, "todo")));
      } else if (input.status === "changes_requested") {
        await ctx.db.update(tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(tasks.deliverableId, d.id));
      }
      await ctx.db.insert(activityLog).values({
        workspaceId: ctx.workspace.id,
        projectId: d.projectId,
        actorMemberId: ctx.member.id,
        type: "deliverable.status",
        payload: { title: d.title, status: input.status },
      });
      return updated!;
    }),

  addVersion: workspaceProcedure
    .input(
      z.object({
        deliverableId: z.string().uuid(),
        note: z.string().optional(),
        link: z.string().url().optional(),
        upload: uploadMeta.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const d = await loadDeliverable(ctx, input.deliverableId);
      if (!input.link && !input.upload) throw new TRPCError({ code: "BAD_REQUEST", message: "Provide a link or an upload" });
      const [latest] = await ctx.db.select({ n: deliverableVersions.versionNumber }).from(deliverableVersions).where(eq(deliverableVersions.deliverableId, d.id)).orderBy(desc(deliverableVersions.versionNumber)).limit(1);
      const versionNumber = (latest?.n ?? 0) + 1;
      let values: typeof deliverableVersions.$inferInsert;
      if (input.link) {
        const parsed = parseVideoLink(input.link);
        // A Drive / Dropbox / Box file link is copied in rather than stored as a URL.
        if (parsed.cloud) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "CLOUD_LINK" });
        values = { deliverableId: d.id, versionNumber, sourceType: parsed.source, url: parsed.url, externalId: parsed.externalId, note: input.note ?? null, uploadedByMemberId: ctx.member.id };
      } else {
        const f = await loadReadyFile(ctx, input.upload!.fileId);
        values = {
          deliverableId: d.id,
          versionNumber,
          sourceType: "upload",
          fileId: f.id,
          storageKey: f.storageKey,
          fileName: f.fileName,
          mimeType: f.mimeType,
          bytes: f.bytes,
          width: f.width,
          height: f.height,
          durationSeconds: f.durationSeconds,
          note: input.note ?? null,
          uploadedByMemberId: ctx.member.id,
        };
      }
      const [version] = await ctx.db.insert(deliverableVersions).values(values).returning();
      if (d.status === "draft" || d.status === "changes_requested") {
        await ctx.db.update(deliverables).set({ status: "in_review", updatedAt: new Date() }).where(eq(deliverables.id, d.id));
        await ctx.db.update(tasks).set({ status: "in_review", updatedAt: new Date() }).where(and(eq(tasks.deliverableId, d.id)));
      }
      await ctx.db.insert(activityLog).values({
        workspaceId: ctx.workspace.id,
        projectId: d.projectId,
        actorMemberId: ctx.member.id,
        type: "version.added",
        payload: { title: d.title, version: versionNumber },
      });
      return version!;
    }),

  deleteVersion: workspaceProcedure.input(z.object({ versionId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const v = await ctx.db.query.deliverableVersions.findFirst({ where: eq(deliverableVersions.id, input.versionId) });
    if (!v) throw new TRPCError({ code: "NOT_FOUND" });
    await loadDeliverable(ctx, v.deliverableId);
    if (v.fileId) await deleteStoredFile(ctx.db, v.fileId);
    else if (v.storageKey) await storage.delete(v.storageKey).catch(() => undefined);
    await ctx.db.delete(deliverableVersions).where(eq(deliverableVersions.id, v.id));
    return { ok: true };
  }),

  /** Asset spec slots for the Profile Kit (workspace) or a project's pre-release / release set. */
  assetSlots: workspaceProcedure
    .input(z.object({ scope: z.enum(["workspace", "prerelease", "release"]), projectId: z.string().uuid().nullable().optional() }))
    .query(async ({ ctx, input }) => {
      const specs = specsForScope(input.scope);
      const rows = await ctx.db.query.deliverables.findMany({
        where: and(
          eq(deliverables.workspaceId, ctx.workspace.id),
          eq(deliverables.assetScope, input.scope),
          input.projectId ? eq(deliverables.projectId, input.projectId) : isNull(deliverables.projectId),
        ),
        with: { versions: { orderBy: [desc(deliverableVersions.versionNumber)], limit: 1 } },
      });
      const byKey = new Map(rows.map((r) => [r.specKey, r]));
      return specs.map((spec) => {
        const slot = byKey.get(spec.key) ?? null;
        const v = slot?.versions[0] ?? null;
        return {
          spec,
          deliverableId: slot?.id ?? null,
          status: slot?.status ?? null,
          version: v
            ? { ...v, publicUrl: v.storageKey ? storage.publicUrl(v.storageKey) : v.url, check: checkAgainstSpec(spec, { width: v.width, height: v.height, bytes: v.bytes, durationSeconds: v.durationSeconds }) }
            : null,
        };
      });
    }),

  ensureSlot: workspaceProcedure
    .input(z.object({ scope: z.enum(["workspace", "prerelease", "release"]), specKey: z.string().min(1), projectId: z.string().uuid().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const spec = ASSET_SPEC_BY_KEY[input.specKey];
      if (!spec) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown spec" });
      const existing = await ctx.db.query.deliverables.findFirst({
        where: and(
          eq(deliverables.workspaceId, ctx.workspace.id),
          eq(deliverables.assetScope, input.scope),
          eq(deliverables.specKey, input.specKey),
          input.projectId ? eq(deliverables.projectId, input.projectId) : isNull(deliverables.projectId),
        ),
      });
      if (existing) return { deliverableId: existing.id };
      const [d] = await ctx.db
        .insert(deliverables)
        .values({
          workspaceId: ctx.workspace.id,
          projectId: input.projectId ?? null,
          kind: spec.mediaType === "video" ? "video" : spec.mediaType === "image" ? "image" : "document",
          title: spec.label,
          specKey: spec.key,
          assetScope: input.scope,
        })
        .returning({ id: deliverables.id });
      return { deliverableId: d!.id };
    }),
});
