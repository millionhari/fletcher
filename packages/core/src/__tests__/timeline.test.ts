import { describe, expect, it } from "vitest";
import { generateTasks, reshiftTasks, validateTimeline } from "../timeline/engine";
import { SINGLE_RELEASE_TIMELINE } from "../templates/single-release";
import { ALBUM_RELEASE_TIMELINE } from "../templates/album-release";
import { snapToWeekday } from "../dates";

// 2026-10-30 is a Friday
const R = "2026-10-30";

describe("generateTasks", () => {
  const tasks = generateTasks(SINGLE_RELEASE_TIMELINE, R);
  const byKey = Object.fromEntries(tasks.map((t) => [t.key, t]));

  it("places distro delivery 6 weeks out and master 44 days out", () => {
    expect(byKey.distro_delivery?.dueDate).toBe("2026-09-18");
    expect(byKey.master?.dueDate).toBe("2026-09-16");
    expect(byKey.master?.startDate).toBe("2026-09-14");
  });

  it("gives the mix engineer 10 days", () => {
    expect(byKey.mix?.dueDate).toBe("2026-09-14");
    expect(byKey.mix?.startDate).toBe("2026-09-04");
  });

  it("puts the announcement 11 days out (a Monday for Friday releases)", () => {
    expect(byKey.announce?.dueDate).toBe("2026-10-19");
  });

  it("puts reports after release", () => {
    expect(byKey.report_fw?.dueDate).toBe("2026-11-06");
  });

  it("sorts by due date and assigns sortOrder", () => {
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i]!.dueDate >= tasks[i - 1]!.dueDate).toBe(true);
      expect(tasks[i]!.sortOrder).toBe(i);
    }
  });

  it("carries template checklists onto generated tasks", () => {
    expect(byKey.release_qc?.checklist.length).toBeGreaterThan(5);
    expect(byKey.mix?.checklist).toEqual([]);
  });

  it("applies template options", () => {
    const base = generateTasks(ALBUM_RELEASE_TIMELINE, R);
    const physical = generateTasks(ALBUM_RELEASE_TIMELINE, R, { enabledOptions: ["physical"] });
    const baseDistro = base.find((t) => t.key === "album_distro")!;
    const physDistro = physical.find((t) => t.key === "album_distro")!;
    expect(baseDistro.dueDate > physDistro.dueDate).toBe(true);
    expect(physical.some((t) => t.key === "vinyl_variants")).toBe(true);
    expect(base.some((t) => t.key === "vinyl_variants")).toBe(false);
  });
});

describe("snapToWeekday", () => {
  it("moves back to the previous Monday", () => {
    expect(snapToWeekday("2026-10-21", "mon", "back")).toBe("2026-10-19");
  });
  it("moves forward to the next Friday", () => {
    expect(snapToWeekday("2026-10-21", "fri", "forward")).toBe("2026-10-23");
  });
  it("stays put when already on the weekday", () => {
    expect(snapToWeekday("2026-10-19", "mon", "back")).toBe("2026-10-19");
  });
});

describe("reshiftTasks", () => {
  const tasks = [
    { id: "a", templateKey: "mix", startDate: "2026-09-04", dueDate: "2026-09-14", isDateOverridden: false },
    { id: "b", templateKey: "master", startDate: "2026-09-14", dueDate: "2026-09-16", isDateOverridden: true },
  ];
  it("shifts non-overridden tasks by the delta and keeps overridden ones", () => {
    const result = reshiftTasks(tasks, R, "2026-11-06");
    expect(result.deltaDays).toBe(7);
    expect(result.tasks[0]?.dueDate).toBe("2026-09-21");
    expect(result.tasks[0]?.startDate).toBe("2026-09-11");
    expect(result.tasks[1]?.dueDate).toBe("2026-09-16");
    expect(result.shiftedIds).toEqual(["a"]);
    expect(result.keptIds).toEqual(["b"]);
  });
  it("is a no-op for the same anchor", () => {
    const result = reshiftTasks(tasks, R, R);
    expect(result.shiftedIds).toEqual([]);
  });
});

describe("validateTimeline", () => {
  it("flags a dependency due after its dependent", () => {
    const warnings = validateTimeline([
      { id: "1", templateKey: "mix", title: "Mix", startDate: null, dueDate: "2026-09-20", isDateOverridden: true },
      { id: "2", templateKey: "master", title: "Master", startDate: null, dueDate: "2026-09-16", isDateOverridden: false, dependsOn: ["mix"] },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.taskId).toBe("2");
    expect(warnings[0]?.severity).toBe("error");
  });
  it("flags overdue open tasks", () => {
    const warnings = validateTimeline(
      [{ id: "1", templateKey: "x", startDate: null, dueDate: "2026-01-01", isDateOverridden: false, status: "todo" }],
      "2026-02-01",
    );
    expect(warnings[0]?.message).toContain("Overdue");
  });
});
