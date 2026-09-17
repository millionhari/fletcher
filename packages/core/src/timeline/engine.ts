import { addDaysISO, diffDaysISO, snapToWeekday, type ISODate } from "../dates";
import type {
  GeneratedTask,
  ShiftableTask,
  TimelineTaskDef,
  TimelineTemplateDef,
  TimelineWarning,
} from "./types";

export interface GenerateOptions {
  enabledOptions?: string[];
}

/** Resolve the effective task list after applying enabled template options. */
export function resolveTaskDefs(def: TimelineTemplateDef, enabled: string[] = []): TimelineTaskDef[] {
  let tasks = [...def.tasks];
  for (const opt of def.options ?? []) {
    if (!enabled.includes(opt.key)) continue;
    if (opt.overrideOffsets) {
      tasks = tasks.map((t) =>
        opt.overrideOffsets && t.key in opt.overrideOffsets
          ? { ...t, offsetDays: opt.overrideOffsets[t.key]! }
          : t,
      );
    }
    if (opt.addTasks) tasks = [...tasks, ...opt.addTasks];
  }
  return tasks;
}

export function computeDueDate(anchor: ISODate, task: TimelineTaskDef): ISODate {
  let due = addDaysISO(anchor, task.offsetDays);
  if (task.snapTo) {
    const direction = task.snapDirection ?? (task.offsetDays < 0 ? "back" : "forward");
    due = snapToWeekday(due, task.snapTo, direction);
  }
  return due;
}

/** Generate dated tasks from a template definition and an anchor date. */
export function generateTasks(
  def: TimelineTemplateDef,
  anchor: ISODate,
  opts: GenerateOptions = {},
): GeneratedTask[] {
  const defs = resolveTaskDefs(def, opts.enabledOptions);
  const phaseOrder = new Map(def.phases.map((p, i) => [p.key, i]));
  const generated = defs.map((t) => {
    const dueDate = computeDueDate(anchor, t);
    const duration = Math.max(0, t.durationDays ?? 0);
    const startDate = addDaysISO(dueDate, -duration);
    return {
      key: t.key,
      title: t.title,
      description: t.description,
      phase: t.phase,
      roleKey: t.roleKey,
      startDate,
      dueDate,
      sortOrder: 0,
      dependsOn: t.dependsOn ?? [],
      deliverable: t.deliverable,
      milestone: t.milestone,
    } satisfies GeneratedTask;
  });
  generated.sort((a, b) => {
    const byDate = a.dueDate.localeCompare(b.dueDate);
    if (byDate !== 0) return byDate;
    return (phaseOrder.get(a.phase) ?? 99) - (phaseOrder.get(b.phase) ?? 99);
  });
  return generated.map((g, i) => ({ ...g, sortOrder: i }));
}

export interface ShiftResult<T extends ShiftableTask> {
  tasks: T[];
  shiftedIds: string[];
  keptIds: string[];
  deltaDays: number;
}

/** Move every non-overridden task by the anchor delta; keep overridden ones where they are. */
export function reshiftTasks<T extends ShiftableTask>(
  tasks: T[],
  oldAnchor: ISODate,
  newAnchor: ISODate,
): ShiftResult<T> {
  const deltaDays = diffDaysISO(newAnchor, oldAnchor);
  const shiftedIds: string[] = [];
  const keptIds: string[] = [];
  const next = tasks.map((t) => {
    if (t.isDateOverridden || deltaDays === 0) {
      keptIds.push(t.id);
      return t;
    }
    shiftedIds.push(t.id);
    return {
      ...t,
      startDate: t.startDate ? addDaysISO(t.startDate, deltaDays) : t.startDate,
      dueDate: t.dueDate ? addDaysISO(t.dueDate, deltaDays) : t.dueDate,
    };
  });
  return { tasks: next, shiftedIds, keptIds, deltaDays };
}

/** Surface ordering problems: a dependency due after its dependent, overdue items, etc. */
export function validateTimeline<T extends ShiftableTask & { title?: string }>(
  tasks: T[],
  today?: ISODate,
): TimelineWarning[] {
  const byKey = new Map<string, T>();
  for (const t of tasks) if (t.templateKey) byKey.set(t.templateKey, t);
  const warnings: TimelineWarning[] = [];
  for (const t of tasks) {
    for (const depKey of t.dependsOn ?? []) {
      const dep = byKey.get(depKey);
      if (!dep || !dep.dueDate || !t.dueDate) continue;
      if (dep.dueDate > t.dueDate) {
        warnings.push({
          taskId: t.id,
          severity: "error",
          message: `"${t.title ?? t.templateKey}" is due before "${dep.title ?? depKey}", which it depends on.`,
        });
      }
    }
    if (today && t.dueDate && t.dueDate < today && t.status && t.status !== "done") {
      warnings.push({ taskId: t.id, severity: "warning", message: `Overdue since ${t.dueDate}.` });
    }
  }
  return warnings;
}
