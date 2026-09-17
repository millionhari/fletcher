import type { DeliverableKind, MemberRole, ProjectType } from "../enums";
import type { ISODate, Weekday } from "../dates";

export interface TimelineTaskDef {
  key: string;
  title: string;
  description?: string;
  phase: string;
  roleKey: MemberRole;
  /** Days relative to the anchor date. Negative = before. */
  offsetDays: number;
  /** How long the work takes; start = due - duration. */
  durationDays?: number;
  dependsOn?: string[];
  snapTo?: Weekday;
  snapDirection?: "back" | "forward";
  deliverable?: { kind: DeliverableKind; specKey?: string };
  /** Milestone that can spawn a child project (e.g. "Single 2" inside an album). */
  milestone?: { projectType: ProjectType; label: string };
  /** Sub-items seeded into the task's checklist. */
  checklist?: string[];
}

export interface TimelinePhaseDef {
  key: string;
  title: string;
}

export interface TimelineOptionDef {
  key: string;
  label: string;
  description?: string;
  addTasks?: TimelineTaskDef[];
  overrideOffsets?: Record<string, number>;
}

export interface TimelineTemplateDef {
  anchorLabel: string;
  phases: TimelinePhaseDef[];
  tasks: TimelineTaskDef[];
  options?: TimelineOptionDef[];
}

export interface GeneratedTask {
  key: string;
  title: string;
  description?: string;
  phase: string;
  roleKey: MemberRole;
  startDate: ISODate;
  dueDate: ISODate;
  sortOrder: number;
  dependsOn: string[];
  deliverable?: { kind: DeliverableKind; specKey?: string };
  milestone?: { projectType: ProjectType; label: string };
  checklist: string[];
}

export interface ShiftableTask {
  id: string;
  templateKey: string | null;
  startDate: ISODate | null;
  dueDate: ISODate | null;
  isDateOverridden: boolean;
  status?: string;
  dependsOn?: string[];
}

export interface TimelineWarning {
  taskId: string;
  severity: "warning" | "error";
  message: string;
}
