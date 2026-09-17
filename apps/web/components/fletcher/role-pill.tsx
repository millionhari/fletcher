import { MEMBER_ROLE_LABELS, type MemberRole } from "@fletcher/core";
import { cn } from "@/lib/utils";

export function RolePill({ role, className }: { role: MemberRole | null | undefined; className?: string }) {
  if (!role) return null;
  return (
    <span className={cn("inline-flex h-5 items-center rounded-md border border-border bg-background px-1.5 text-2xs font-medium text-muted-foreground whitespace-nowrap", className)}>
      {MEMBER_ROLE_LABELS[role]}
    </span>
  );
}
