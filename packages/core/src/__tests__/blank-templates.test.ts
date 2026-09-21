import { describe, expect, it } from "vitest";
import { PROJECT_TYPES } from "../enums";
import { commsTemplateDefSchema, timelineTemplateDefSchema } from "../schemas";
import { blankCommsTemplateDef, blankTimelineTemplateDef, DEFAULT_ANCHOR_LABELS } from "../templates/blank";
import { generateCommsMoments } from "../comms/generate";
import { generateTasks } from "../timeline/engine";

describe("blank templates", () => {
  it("produces a valid definition for every project type", () => {
    for (const type of PROJECT_TYPES) {
      const def = blankTimelineTemplateDef(type);
      expect(() => timelineTemplateDefSchema.parse(def)).not.toThrow();
      expect(def.anchorLabel).toBe(DEFAULT_ANCHOR_LABELS[type]);
      expect(def.phases.length).toBeGreaterThan(0);
    }
    expect(() => commsTemplateDefSchema.parse(blankCommsTemplateDef())).not.toThrow();
  });

  it("generates nothing until the user adds tasks or moments", () => {
    expect(generateTasks(blankTimelineTemplateDef("single"), "2026-10-30")).toEqual([]);
    expect(generateCommsMoments(blankCommsTemplateDef(), "2026-10-30")).toEqual([]);
  });
});
