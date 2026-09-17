import { and, eq, isNull, or } from "drizzle-orm";
import {
  commsTemplateDefSchema,
  generateCommsMoments,
  generateTasks,
  timelineTemplateDefSchema,
  type CommsTemplateDef,
  type GeneratedMomentItem,
  type ProjectType,
  type TimelineTemplateDef,
} from "@fletcher/core";
import type { Db } from "../client";
import { commsMomentItems, commsMoments, commsPlans, deliverables, projects, tasks, templates } from "../schema";

export interface CreateProjectInput {
  workspaceId: string;
  type: ProjectType;
  name: string;
  anchorDate: string;
  timelineTemplateId?: string | null;
  commsTemplateId?: string | null;
  enabledOptions?: string[];
  parentProjectId?: string | null;
  color?: string;
  releaseInfo?: Record<string, unknown>;
  timezone?: string;
}

/** Pick the workspace default template for a type/kind, else the system template. */
export async function findDefaultTemplate(
  db: Db,
  workspaceId: string,
  kind: "timeline" | "comms",
  projectType: ProjectType,
) {
  const rows = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.kind, kind),
        eq(templates.projectType, projectType),
        or(eq(templates.workspaceId, workspaceId), isNull(templates.workspaceId)),
      ),
    );
  const workspaceDefault = rows.find((r) => r.workspaceId === workspaceId && r.isDefault);
  const anyWorkspace = rows.find((r) => r.workspaceId === workspaceId);
  const system = rows.find((r) => r.workspaceId === null);
  return workspaceDefault ?? anyWorkspace ?? system ?? null;
}

async function insertItems(
  db: Db,
  momentId: string,
  items: GeneratedMomentItem[],
  parentItemId: string | null,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const [row] = await db
      .insert(commsMomentItems)
      .values({ momentId, parentItemId, platform: item.platform, title: item.title, sortOrder: i })
      .returning({ id: commsMomentItems.id });
    if (item.children.length) await insertItems(db, momentId, item.children, row!.id);
  }
}

export async function createCommsPlanFromTemplate(
  db: Db,
  projectId: string,
  name: string,
  def: CommsTemplateDef,
  anchorDate: string,
  timezone: string,
) {
  const [plan] = await db.insert(commsPlans).values({ projectId, name }).returning();
  let order = 0;
  for (const checklist of def.checklists ?? []) {
    const [moment] = await db
      .insert(commsMoments)
      .values({
        planId: plan!.id,
        templateKey: checklist.key,
        title: checklist.title,
        assetNote: checklist.description ?? null,
        isChecklist: true,
        sortOrder: order++,
      })
      .returning();
    await insertItems(
      db,
      moment!.id,
      checklist.items.map((i) => ({ platform: i.platform, title: i.title, children: (i.children ?? []).map((c) => ({ platform: c.platform, title: c.title, children: [] })) })),
      null,
    );
  }
  const generated = generateCommsMoments(def, anchorDate);
  for (const m of generated) {
    const [moment] = await db
      .insert(commsMoments)
      .values({
        planId: plan!.id,
        templateKey: m.key,
        title: m.title,
        scheduledDate: m.scheduledDate,
        scheduledTime: m.scheduledTime,
        timezone,
        cta: m.cta,
        assetNote: m.assetHint,
        sortOrder: order++,
      })
      .returning();
    await insertItems(db, moment!.id, m.items, null);
  }
  return plan!;
}

/** Create a project and materialize its tasks, deliverables and comms plan from templates. */
export async function createProjectWithTemplates(db: Db, input: CreateProjectInput) {
  const timelineTemplate = input.timelineTemplateId
    ? await db.query.templates.findFirst({ where: eq(templates.id, input.timelineTemplateId) })
    : await findDefaultTemplate(db, input.workspaceId, "timeline", input.type);
  const commsTemplate = input.commsTemplateId
    ? await db.query.templates.findFirst({ where: eq(templates.id, input.commsTemplateId) })
    : await findDefaultTemplate(db, input.workspaceId, "comms", input.type);

  const timelineDef: TimelineTemplateDef | null = timelineTemplate
    ? timelineTemplateDefSchema.parse(timelineTemplate.definition)
    : null;

  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: input.workspaceId,
      type: input.type,
      name: input.name,
      anchorDate: input.anchorDate,
      anchorLabel: timelineDef?.anchorLabel ?? "Date",
      timelineTemplateId: timelineTemplate?.id ?? null,
      commsTemplateId: commsTemplate?.id ?? null,
      enabledOptions: input.enabledOptions ?? [],
      parentProjectId: input.parentProjectId ?? null,
      color: input.color ?? pickColor(input.name),
      releaseInfo: input.releaseInfo ?? {},
      status: "active",
    })
    .returning();

  if (timelineDef) {
    const generated = generateTasks(timelineDef, input.anchorDate, { enabledOptions: input.enabledOptions });
    for (const g of generated) {
      let deliverableId: string | null = null;
      if (g.deliverable) {
        const [d] = await db
          .insert(deliverables)
          .values({
            workspaceId: input.workspaceId,
            projectId: project!.id,
            kind: g.deliverable.kind,
            title: g.title,
            specKey: g.deliverable.specKey ?? null,
            assetScope: g.deliverable.specKey ? "release" : null,
          })
          .returning({ id: deliverables.id });
        deliverableId = d!.id;
      }
      await db.insert(tasks).values({
        projectId: project!.id,
        templateKey: g.key,
        title: g.title,
        description: g.description ?? null,
        phase: g.phase,
        roleKey: g.roleKey,
        startDate: g.startDate,
        dueDate: g.dueDate,
        dependsOn: g.dependsOn,
        deliverableId,
        milestone: g.milestone ?? null,
        sortOrder: g.sortOrder,
      });
    }
  }

  if (commsTemplate) {
    const def = commsTemplateDefSchema.parse(commsTemplate.definition) as CommsTemplateDef;
    await createCommsPlanFromTemplate(db, project!.id, `${input.name} comms plan`, def, input.anchorDate, input.timezone ?? "America/Chicago");
  }

  return project!;
}

const PALETTE = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0d9488"];
function pickColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
