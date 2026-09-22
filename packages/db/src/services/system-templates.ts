import { SYSTEM_TEMPLATES } from "@fletcher/core";
import type { Db } from "../client";
import { templates } from "../schema";

/**
 * The built-in timeline / comms templates live in code and are mirrored into
 * the templates table (workspace_id null). Idempotent: run it whenever a
 * workspace is created so a fresh database never lacks them.
 */
export async function ensureSystemTemplates(db: Db): Promise<number> {
  for (const t of SYSTEM_TEMPLATES) {
    await db
      .insert(templates)
      .values({ systemKey: t.key, workspaceId: null, kind: t.kind, projectType: t.projectType, name: t.name, description: t.description, isDefault: true, definition: t.definition })
      .onConflictDoUpdate({ target: templates.systemKey, set: { name: t.name, description: t.description, definition: t.definition, updatedAt: new Date() } });
  }
  return SYSTEM_TEMPLATES.length;
}
