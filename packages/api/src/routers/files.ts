import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { isVideoFile } from "@fletcher/core";
import { deliverables, deliverableVersions, projects, taskAttachments, tasks, users, workspaceFiles, workspaceMembers } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { requirePermission } from "../context";
import { storage, newStorageKey } from "../storage";
import { assertUploadAllowed, deleteStoredFile, workspaceUsage } from "../files";

const dims = { width: z.number().int().positive().nullable().optional(), height: z.number().int().positive().nullable().optional(), durationSeconds: z.number().nonnegative().nullable().optional() };

export const filesRouter = router({
  usage: workspaceProcedure.query(({ ctx }) => workspaceUsage(ctx.db, ctx.workspace)),

  /**
   * Step 1 of a browser upload: check the rules, reserve a row (counts toward
   * quota from now), and hand back where to put the bytes. Under the local
   * driver the browser posts to /api/upload instead.
   */
  createUpload: workspaceProcedure
    .input(z.object({ fileName: z.string().min(1).max(255), mimeType: z.string().max(200), bytes: z.number().int().nonnegative(), folder: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await assertUploadAllowed(ctx, input);
      const storageKey = newStorageKey(`ws/${ctx.workspace.id}/${input.folder}`, input.fileName);
      const [row] = await ctx.db
        .insert(workspaceFiles)
        .values({ workspaceId: ctx.workspace.id, storageKey, fileName: input.fileName, mimeType: input.mimeType || "application/octet-stream", bytes: input.bytes, status: "pending", origin: "upload", uploadedByMemberId: ctx.member.id })
        .returning();
      const signed = await storage.createSignedUploadUrl(storageKey);
      return signed
        ? { fileId: row!.id, storageKey, mode: "signed" as const, url: signed.url, token: signed.token }
        : { fileId: row!.id, storageKey, mode: "local" as const, url: "/api/upload" };
    }),

  /** Step 2: the object exists; record its real size and mark it usable. */
  finalizeUpload: workspaceProcedure
    .input(z.object({ fileId: z.string().uuid(), ...dims }))
    .mutation(async ({ ctx, input }) => {
      const f = await ctx.db.query.workspaceFiles.findFirst({ where: and(eq(workspaceFiles.id, input.fileId), eq(workspaceFiles.workspaceId, ctx.workspace.id)) });
      if (!f) throw new TRPCError({ code: "NOT_FOUND" });
      if (f.status === "ready") return f;
      const head = await storage.head(f.storageKey);
      if (!head) {
        await ctx.db.delete(workspaceFiles).where(eq(workspaceFiles.id, f.id));
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The upload didn't complete. Try again." });
      }
      // The reservation used the browser's number; re-check with what actually landed.
      const usage = await workspaceUsage(ctx.db, ctx.workspace);
      if (usage.usedBytes - f.bytes + head.bytes > usage.quotaBytes) {
        await deleteStoredFile(ctx.db, f.id);
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "That file would put the workspace over its storage limit." });
      }
      const [row] = await ctx.db
        .update(workspaceFiles)
        .set({ bytes: head.bytes, mimeType: head.mimeType ?? f.mimeType, width: input.width ?? null, height: input.height ?? null, durationSeconds: input.durationSeconds ?? null, status: "ready", readyAt: new Date() })
        .where(eq(workspaceFiles.id, f.id))
        .returning();
      return row!;
    }),

  list: workspaceProcedure
    .input(z.object({
      sort: z.enum(["size", "date", "name"]).default("date"),
      dir: z.enum(["asc", "desc"]).default("desc"),
      type: z.enum(["video", "image", "audio", "document", "other"]).optional(),
      search: z.string().max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const order = input.sort === "size" ? workspaceFiles.bytes : input.sort === "name" ? workspaceFiles.fileName : workspaceFiles.createdAt;
      const rows = await ctx.db
        .select({ file: workspaceFiles, uploaderName: users.name })
        .from(workspaceFiles)
        .leftJoin(workspaceMembers, eq(workspaceFiles.uploadedByMemberId, workspaceMembers.id))
        .leftJoin(users, eq(workspaceMembers.userId, users.id))
        .where(and(
          eq(workspaceFiles.workspaceId, ctx.workspace.id),
          inArray(workspaceFiles.status, ["importing", "ready", "failed"]),
          input.search ? ilike(workspaceFiles.fileName, `%${input.search}%`) : undefined,
        ))
        .orderBy(input.dir === "asc" ? asc(order) : desc(order))
        .limit(500);
      const ids = rows.map((r) => r.file.id);
      if (!ids.length) return [];

      // Where each file is used — a version on a deliverable, or an attachment on a task.
      const versionUses = await ctx.db
        .select({ fileId: deliverableVersions.fileId, versionNumber: deliverableVersions.versionNumber, deliverableId: deliverables.id, deliverableTitle: deliverables.title, specKey: deliverables.specKey, projectId: projects.id, projectName: projects.name, projectColor: projects.color })
        .from(deliverableVersions)
        .innerJoin(deliverables, eq(deliverableVersions.deliverableId, deliverables.id))
        .leftJoin(projects, eq(deliverables.projectId, projects.id))
        .where(inArray(deliverableVersions.fileId, ids));
      const attachmentUses = await ctx.db
        .select({ fileId: taskAttachments.fileId, taskId: tasks.id, taskTitle: tasks.title, projectId: projects.id, projectName: projects.name, projectColor: projects.color })
        .from(taskAttachments)
        .innerJoin(tasks, eq(taskAttachments.taskId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(inArray(taskAttachments.fileId, ids));
      const vByFile = new Map(versionUses.map((v) => [v.fileId!, v]));
      const aByFile = new Map(attachmentUses.map((a) => [a.fileId!, a]));

      const typeOf = (mime: string, name: string): "video" | "image" | "audio" | "document" | "other" =>
        isVideoFile(mime, name) ? "video" : mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : mime === "application/pdf" || /\.(pdf|docx?|pptx?|xlsx?|txt)$/i.test(name) ? "document" : "other";

      return rows
        .map((r) => {
          const v = vByFile.get(r.file.id);
          const a = aByFile.get(r.file.id);
          const usedIn = v
            ? { kind: "version" as const, versionNumber: v.versionNumber, deliverableId: v.deliverableId, deliverableTitle: v.deliverableTitle, isProfileKit: !v.projectId && !!v.specKey, projectId: v.projectId, projectName: v.projectName, projectColor: v.projectColor }
            : a
              ? { kind: "attachment" as const, taskId: a.taskId, taskTitle: a.taskTitle, projectId: a.projectId, projectName: a.projectName, projectColor: a.projectColor }
              : null;
          return { ...r.file, uploaderName: r.uploaderName, type: typeOf(r.file.mimeType, r.file.fileName), usedIn, publicUrl: storage.publicUrl(r.file.storageKey) };
        })
        .filter((f) => !input.type || f.type === input.type);
    }),

  delete: workspaceProcedure.input(z.object({ fileId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const f = await ctx.db.query.workspaceFiles.findFirst({ where: and(eq(workspaceFiles.id, input.fileId), eq(workspaceFiles.workspaceId, ctx.workspace.id)) });
    if (!f) throw new TRPCError({ code: "NOT_FOUND" });
    if (f.uploadedByMemberId !== ctx.member.id) requirePermission(ctx.member, ["owner", "admin"]);
    await deleteStoredFile(ctx.db, f.id);
    return { ok: true };
  }),

  /** How much of the quota each file type takes — for the meter breakdown. */
  breakdown: workspaceProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ mime: workspaceFiles.mimeType, name: workspaceFiles.fileName, bytes: sql<number>`sum(${workspaceFiles.bytes})::bigint` })
      .from(workspaceFiles)
      .where(and(eq(workspaceFiles.workspaceId, ctx.workspace.id), inArray(workspaceFiles.status, ["importing", "ready"])))
      .groupBy(workspaceFiles.mimeType, workspaceFiles.fileName);
    const out = { video: 0, image: 0, audio: 0, document: 0, other: 0 };
    for (const r of rows) {
      const b = Number(r.bytes);
      if (isVideoFile(r.mime, r.name)) out.video += b;
      else if (r.mime.startsWith("image/")) out.image += b;
      else if (r.mime.startsWith("audio/")) out.audio += b;
      else if (r.mime === "application/pdf") out.document += b;
      else out.other += b;
    }
    return out;
  }),
});
