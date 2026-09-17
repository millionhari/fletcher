import { describe, expect, it } from "vitest";
import { countItems, generateCommsMoments } from "../comms/generate";
import { SINGLE_RELEASE_COMMS } from "../templates/comms-single";
import { commsTemplateDefSchema, timelineTemplateDefSchema } from "../schemas";
import { SYSTEM_TEMPLATES } from "../templates";

describe("generateCommsMoments", () => {
  const moments = generateCommsMoments(SINGLE_RELEASE_COMMS, "2026-10-30");
  it("dates moments relative to the anchor and orders them", () => {
    expect(moments[0]?.key).toBe("crm_teaser");
    expect(moments[0]?.scheduledDate).toBe("2026-10-18");
    const night = moments.find((m) => m.key === "release_night")!;
    expect(night.scheduledDate).toBe("2026-10-30");
    expect(night.scheduledTime).toBe("00:00");
    for (let i = 1; i < moments.length; i++) expect(moments[i]!.sortOrder).toBe(i);
  });
  it("carries nested platform checklists", () => {
    const announce = moments.find((m) => m.key === "announce")!;
    expect(countItems(announce.items)).toBeGreaterThan(20);
  });
});

describe("system templates validate against their schemas", () => {
  for (const t of SYSTEM_TEMPLATES) {
    it(t.key, () => {
      const schema = t.kind === "timeline" ? timelineTemplateDefSchema : commsTemplateDefSchema;
      expect(() => schema.parse(t.definition)).not.toThrow();
    });
  }
  it("timeline dependencies reference existing keys", () => {
    for (const t of SYSTEM_TEMPLATES) {
      if (t.kind !== "timeline") continue;
      const def = t.definition as { tasks: { key: string; dependsOn?: string[] }[] };
      const keys = new Set(def.tasks.map((x) => x.key));
      for (const task of def.tasks) for (const d of task.dependsOn ?? []) expect(keys.has(d)).toBe(true);
    }
  });
});
