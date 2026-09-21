import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { blankCommsTemplateDef, blankTimelineTemplateDef, commsTemplateDefSchema, PROJECT_TYPES, TEMPLATE_KINDS, timelineTemplateDefSchema } from "@fletcher/core";
import { templates } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

export const templatesRouter = router({
  list: workspaceProcedure
    .input(z.object({ kind: z.enum(TEMPLATE_KINDS).optional(), projectType: z.enum(PROJECT_TYPES).optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(templates)
        .where(
          and(
            or(eq(templates.workspaceId, ctx.workspace.id), isNull(templates.workspaceId)),
            input.kind ? eq(templates.kind, input.kind) : undefined,
            input.projectType ? eq(templates.projectType, input.projectType) : undefined,
          ),
        )
        .orderBy(templates.projectType, templates.kind, templates.name);
      return rows.map((r) => ({ ...r, isSystem: r.workspaceId === null }));
    }),

  get: workspaceProcedure.input(z.object({ templateId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const row = await ctx.db.query.templates.findFirst({ where: eq(templates.id, input.templateId) });
    if (!row || (row.workspaceId && row.workspaceId !== ctx.workspace.id)) throw new TRPCError({ code: "NOT_FOUND" });
    return { ...row, isSystem: row.workspaceId === null };
  }),

  create: workspaceProcedure
    .input(
      z.object({
        kind: z.enum(TEMPLATE_KINDS),
        projectType: z.enum(PROJECT_TYPES),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        anchorLabel: z.string().min(1).optional(),
        definition: z.unknown().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const blank = input.kind === "timeline" ? blankTimelineTemplateDef(input.projectType) : blankCommsTemplateDef();
      const raw = input.definition ?? blank;
      const parsed = input.kind === "timeline" ? timelineTemplateDefSchema.parse(raw) : commsTemplateDefSchema.parse(raw);
      const definition = input.kind === "timeline" && input.anchorLabel ? { ...parsed, anchorLabel: input.anchorLabel } : parsed;
      const [created] = await ctx.db
        .insert(templates)
        .values({
          workspaceId: ctx.workspace.id,
          kind: input.kind,
          projectType: input.projectType,
          name: input.name,
          description: input.description ?? null,
          definition,
          isDefault: false,
        })
        .returning();
      return created!;
    }),

  duplicateToWorkspace: workspaceProcedure
    .input(z.object({ templateId: z.string().uuid(), name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const src = await ctx.db.query.templates.findFirst({ where: eq(templates.id, input.templateId) });
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });
      const [copy] = await ctx.db
        .insert(templates)
        .values({
          workspaceId: ctx.workspace.id,
          kind: src.kind,
          projectType: src.projectType,
          name: input.name ?? `${src.name} (custom)`,
          description: src.description,
          definition: src.definition,
          isDefault: false,
        })
        .returning();
      return copy!;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        definition: z.unknown().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.templates.findFirst({ where: eq(templates.id, input.templateId) });
      if (!row || row.workspaceId !== ctx.workspace.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "System templates are read-only. Duplicate it to your workspace first." });
      }
      let definition = row.definition;
      if (input.definition !== undefined) {
        definition = row.kind === "timeline" ? timelineTemplateDefSchema.parse(input.definition) : commsTemplateDefSchema.parse(input.definition);
      }
      const [updated] = await ctx.db
        .update(templates)
        .set({ name: input.name ?? row.name, description: input.description === undefined ? row.description : input.description, definition, updatedAt: new Date() })
        .where(eq(templates.id, row.id))
        .returning();
      return updated!;
    }),

  setDefault: workspaceProcedure.input(z.object({ templateId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const row = await ctx.db.query.templates.findFirst({ where: eq(templates.id, input.templateId) });
    if (!row || row.workspaceId !== ctx.workspace.id) throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.db
      .update(templates)
      .set({ isDefault: false })
      .where(and(eq(templates.workspaceId, ctx.workspace.id), eq(templates.kind, row.kind), eq(templates.projectType, row.projectType)));
    await ctx.db.update(templates).set({ isDefault: true }).where(eq(templates.id, row.id));
    return { ok: true };
  }),

  delete: workspaceProcedure.input(z.object({ templateId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const row = await ctx.db.query.templates.findFirst({ where: eq(templates.id, input.templateId) });
    if (!row || row.workspaceId !== ctx.workspace.id) throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.db.delete(templates).where(eq(templates.id, row.id));
    return { ok: true };
  }),
});
