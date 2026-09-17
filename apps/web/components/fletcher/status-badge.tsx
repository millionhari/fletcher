import { cn } from "@/lib/utils";
import {
  DELIVERABLE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type DeliverableStatus,
  type MomentStatus,
  type ProjectStatus,
  type TaskStatus,
} from "@fletcher/core";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  brand: "bg-brand-soft text-brand",
};

const DOT_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  brand: "bg-brand",
};

export function Pill({ tone = "neutral", children, dot = true, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-2xs font-medium whitespace-nowrap", TONE_CLASSES[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", DOT_CLASSES[tone])} />}
      {children}
    </span>
  );
}

const TASK_TONE: Record<TaskStatus, Tone> = { todo: "neutral", in_progress: "info", in_review: "brand", blocked: "danger", done: "success" };
export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return <Pill tone={TASK_TONE[status]} className={className}>{TASK_STATUS_LABELS[status]}</Pill>;
}

const DELIVERABLE_TONE: Record<DeliverableStatus, Tone> = { draft: "neutral", in_review: "brand", changes_requested: "warning", approved: "success" };
export function DeliverableStatusBadge({ status, className }: { status: DeliverableStatus; className?: string }) {
  return <Pill tone={DELIVERABLE_TONE[status]} className={className}>{DELIVERABLE_STATUS_LABELS[status]}</Pill>;
}

const PROJECT_TONE: Record<ProjectStatus, Tone> = { planning: "neutral", active: "info", released: "success", archived: "neutral" };
export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return <Pill tone={PROJECT_TONE[status]} className={className}>{status[0]!.toUpperCase() + status.slice(1)}</Pill>;
}

const MOMENT_TONE: Record<MomentStatus, Tone> = { planned: "neutral", ready: "info", posted: "success", skipped: "warning" };
export function MomentStatusBadge({ status, className }: { status: MomentStatus; className?: string }) {
  return <Pill tone={MOMENT_TONE[status]} className={className}>{status[0]!.toUpperCase() + status.slice(1)}</Pill>;
}

export function SpecStatusPill({ status }: { status: "ok" | "wrong_dimensions" | "too_large" | "too_long" | "too_short" | "unknown" | "missing" }) {
  const map: Record<typeof status, { tone: Tone; label: string }> = {
    ok: { tone: "success", label: "Meets spec" },
    wrong_dimensions: { tone: "danger", label: "Wrong size" },
    too_large: { tone: "danger", label: "Too large" },
    too_long: { tone: "danger", label: "Too long" },
    too_short: { tone: "danger", label: "Too short" },
    unknown: { tone: "warning", label: "Unverified" },
    missing: { tone: "neutral", label: "Missing" },
  };
  const m = map[status];
  return <Pill tone={m.tone}>{m.label}</Pill>;
}
