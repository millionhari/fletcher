"use client";

import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, ListTodo, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, relativeDays } from "@/lib/format";
import { useMembers } from "@/lib/hooks/use-project-data";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { RolePill } from "@/components/fletcher/role-pill";

/**
 * Who this person is, at a glance, when hovering an assignee. Wraps any
 * trigger; renders the trigger alone when there is nobody to describe.
 */
export function MemberHoverCard({ memberId, children }: { memberId: string | null | undefined; children: React.ReactNode }) {
  const ws = useWorkspace();
  const members = useMembers();
  const m = memberId ? (members.data ?? []).find((x) => x.id === memberId) : undefined;
  if (!m) return <>{children}</>;
  const isMe = m.id === ws.memberId;
  const subtitle = [m.title, m.company].filter(Boolean).join(" · ");
  return (
    <HoverCard openDelay={350} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" align="end" className="w-72" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <MemberAvatar name={m.name} avatarUrl={m.avatarUrl} size="lg" showTooltip={false} className="ring-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{m.name}</span>
              {isMe && <span className="rounded bg-muted px-1 text-2xs text-muted-foreground">you</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <RolePill role={m.role} />
              {m.isExternal && <span className="text-2xs text-muted-foreground">External</span>}
            </div>
            {subtitle && <div className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><Building2 className="size-3 shrink-0" />{subtitle}</div>}
          </div>
        </div>
        <a href={`mailto:${m.email}`} className="mt-2.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground"><Mail className="size-3 shrink-0" />{m.email}</a>
        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-xs">
          <Stat icon={ListTodo} label="Open" value={m.openTasks} />
          <Stat icon={AlertTriangle} label="Overdue" value={m.overdueTasks} tone={m.overdueTasks > 0 ? "text-danger" : undefined} />
          <Stat icon={CalendarClock} label="Next due" value={m.nextDueDate ? fmtDate(m.nextDueDate) : "—"} hint={m.nextDueDate ? relativeDays(m.nextDueDate) : undefined} />
        </div>
        <Link href={`/w/${ws.slug}?person=${m.id}`} className="mt-2.5 block text-xs text-brand hover:underline">See {isMe ? "your" : `${m.name.split(" ")[0]}'s`} work →</Link>
      </HoverCardContent>
    </HoverCard>
  );
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-2xs text-muted-foreground"><Icon className="size-3" />{label}</div>
      <div className={cn("tabular truncate font-medium", tone)}>{value}{hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}</div>
    </div>
  );
}
