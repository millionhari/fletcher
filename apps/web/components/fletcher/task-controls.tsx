"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, ChevronDown, Pin, PinOff, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from "@fletcher/core";
import { useInvalidateProject, useMembers } from "@/lib/hooks/use-project-data";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/fletcher/status-badge";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { MemberHoverCard } from "@/components/fletcher/member-hover-card";
import { RolePill } from "@/components/fletcher/role-pill";
import { useState } from "react";

export function useTaskUpdate() {
  const trpc = useTRPC();
  const ws = useWorkspace();
  const invalidate = useInvalidateProject();
  const m = useMutation(trpc.tasks.update.mutationOptions({ onSuccess: () => invalidate(), onError: (e) => toast.error(e.message) }));
  return { update: (input: Omit<Parameters<typeof m.mutate>[0], "workspace">) => m.mutate({ workspace: ws.slug, ...input }), isPending: m.isPending };
}

/** Status pill that opens a menu of the other statuses. */
export function StatusSelect({ taskId, status, size = "sm" }: { taskId: string; status: TaskStatus; size?: "sm" | "md" }) {
  const { update } = useTaskUpdate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group/status cursor-pointer rounded-md outline-none focus:outline-none focus-visible:outline-none" aria-label="Change status" title="Change status">
        <TaskStatusBadge status={status} className={cn("transition-[filter] group-hover/status:brightness-90 group-aria-expanded/status:brightness-90 dark:group-hover/status:brightness-125 dark:group-aria-expanded/status:brightness-125", size === "md" && "h-6 px-2 text-xs")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {TASK_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onClick={() => update({ taskId, status: s })}>
            <TaskStatusBadge status={s} />
            {s === status && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Assignee avatar that opens the member list, grouped so the role's people come first. */
export function AssigneePicker({ taskId, assigneeMemberId, assigneeName, roleKey, compact = true }: { taskId: string; assigneeMemberId: string | null; assigneeName: string | null; roleKey: string | null; compact?: boolean }) {
  const { update } = useTaskUpdate();
  const members = useMembers();
  const list = members.data ?? [];
  const suggested = list.filter((m) => m.role === roleKey);
  const others = list.filter((m) => m.role !== roleKey);
  return (
    <DropdownMenu>
      <MemberHoverCard memberId={assigneeMemberId}>
      <DropdownMenuTrigger className="group/assignee flex cursor-pointer items-center gap-1.5 rounded-full outline-none focus:outline-none focus-visible:outline-none [&>span:first-child]:transition-[filter] hover:[&>span:first-child]:brightness-90 dark:hover:[&>span:first-child]:brightness-125" aria-label="Assign" title="Assign">
        <MemberAvatar name={assigneeName} size={compact ? "xs" : "sm"} showTooltip={false} />
        {!compact && <span className="text-xs">{assigneeName ?? <span className="text-muted-foreground">Unassigned</span>}</span>}
      </DropdownMenuTrigger>
      </MemberHoverCard>
      <DropdownMenuContent align="end" className="w-56">
        {suggested.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">Suggested <RolePill role={roleKey as never} /></DropdownMenuLabel>
            {suggested.map((m) => <MemberItem key={m.id} name={m.name} selected={m.id === assigneeMemberId} onSelect={() => update({ taskId, assigneeMemberId: m.id })} />)}
            <DropdownMenuSeparator />
          </>
        )}
        {others.map((m) => <MemberItem key={m.id} name={m.name} selected={m.id === assigneeMemberId} onSelect={() => update({ taskId, assigneeMemberId: m.id })} />)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => update({ taskId, assigneeMemberId: null })}><User className="text-muted-foreground" />Unassigned</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MemberItem({ name, selected, onSelect }: { name: string; selected: boolean; onSelect: () => void }) {
  return (
    <DropdownMenuItem onClick={onSelect}>
      <MemberAvatar name={name} size="xs" showTooltip={false} />
      {name}
      {selected && <Check className="ml-auto size-3.5" />}
    </DropdownMenuItem>
  );
}

/** Inline due-date editor. Shows the pin when the date is manually overridden. */
export function DatePill({ taskId, dueDate, isOverridden, overdue, className }: { taskId: string; dueDate: string | null; isOverridden: boolean; overdue?: boolean; className?: string }) {
  const { update } = useTaskUpdate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(dueDate ?? "");
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(dueDate ?? ""); }}>
      <PopoverTrigger title="Change due date" className={cn("tabular group/date inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs outline-none transition-colors hover:bg-muted focus:outline-none focus-visible:outline-none aria-expanded:bg-muted", overdue ? "font-medium text-danger" : "text-foreground", className)}>
        {isOverridden && <Pin className="size-3 text-warning" />}
        <span className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 group-hover/date:decoration-foreground/60">{fmtDate(dueDate)}</span>
        <ChevronDown className="size-3 text-muted-foreground transition-colors group-hover/date:text-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="mb-2 text-xs font-medium">Due date</div>
        <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} className="tabular" />
        <p className="mt-2 text-2xs text-muted-foreground">Setting a date by hand pins it, so moving the {" "}project date won&apos;t shift it.</p>
        <div className="mt-3 flex items-center justify-between">
          {isOverridden ? (
            <Button variant="ghost" size="xs" onClick={() => { update({ taskId, clearOverride: true }); setOpen(false); }}><PinOff />Unpin</Button>
          ) : <span />}
          <Button size="xs" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(value)} onClick={() => { update({ taskId, dueDate: value }); setOpen(false); }}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { TASK_STATUS_LABELS };
