"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Plus, Trash2, Archive } from "lucide-react";
import { DotsIcon } from "@/components/fletcher/dots-icon";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateYear, relativeDays } from "@/lib/format";
import { PROJECT_TYPE_LABELS } from "@fletcher/core";
import { useProjectData, useInvalidateProject } from "@/lib/hooks/use-project-data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectStatusBadge } from "@/components/fletcher/status-badge";
import { ProgressRing } from "@/components/fletcher/progress-ring";
import { BackButton } from "@/components/fletcher/back-button";

export function ProjectHeader() {
  const { data, isLoading, ws, projectId, trpc } = useProjectData();
  const pathname = usePathname();
  const router = useRouter();
  const invalidate = useInvalidateProject();
  const [dateOpen, setDateOpen] = useState(false);
  const base = `/w/${ws.slug}/projects/${projectId}`;
  const onTaskPage = pathname.includes("/tasks/");

  const archive = useMutation(trpc.projects.archive.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("Project archived"); router.refresh(); } }));
  const del = useMutation(trpc.projects.delete.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("Project deleted"); router.push(`/w/${ws.slug}/projects`); router.refresh(); } }));

  if (isLoading || !data) {
    return (
      <div className="mb-6 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-96" />
      </div>
    );
  }
  const { project, parent, tasks } = data;
  const done = tasks.filter((t) => t.status === "done").length;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/timeline`, label: "Timeline" },
    { href: `${base}/board`, label: "Board" },
    { href: `${base}/deliverables`, label: "Deliverables", count: data.deliverables.filter((d) => !d.specKey).length },
    { href: `${base}/comms`, label: "Comms", count: data.commsSummary.momentCount },
    { href: `${base}/assets`, label: "Assets" },
  ];

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <BackButton fallback={onTaskPage ? `/w/${ws.slug}/projects/${projectId}/timeline` : parent ? `/w/${ws.slug}/projects/${parent.id}` : `/w/${ws.slug}/projects`} />
        <span className="h-4 w-px bg-border" />
        <Link href={`/w/${ws.slug}/projects`} className="hover:text-foreground">Projects</Link>
        {parent && (<><ChevronRight className="size-3" /><Link href={`/w/${ws.slug}/projects/${parent.id}`} className="hover:text-foreground">{parent.name}</Link></>)}
        <ChevronRight className="size-3" />
        <span className="text-foreground">{project.name}</span>
      </div>
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="mt-0.5 size-3 shrink-0 rounded-[4px]" style={{ background: project.color }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold leading-7">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{PROJECT_TYPE_LABELS[project.type]}</span>
              <span>·</span>
              <ProgressRing value={tasks.length ? Math.round((done / tasks.length) * 100) : 0} size={14} stroke={2} />
              <span className="tabular">{done}/{tasks.length} tasks</span>
              {data.warnings.length > 0 && (<><span>·</span><span className="text-warning">{data.warnings.length} warnings</span></>)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setDateOpen(true)} className="surface flex items-center gap-3 px-3 py-1.5 text-left transition-shadow hover:shadow-float">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span>
              <span className="block text-2xs uppercase tracking-wider text-muted-foreground">{project.anchorLabel}</span>
              <span className="tabular block text-sm font-semibold leading-4">{fmtDateYear(project.anchorDate)} <span className="font-normal text-muted-foreground">· {relativeDays(project.anchorDate)}</span></span>
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More"><DotsIcon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild><Link href={`/w/${ws.slug}/projects/new?parent=${projectId}&type=music_video`}><Plus />Add child project</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => archive.mutate({ workspace: ws.slug, projectId })}><Archive />Archive</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => { if (confirm(`Delete "${project.name}" and everything in it?`)) del.mutate({ workspace: ws.slug, projectId }); }}><Trash2 />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {!onTaskPage && <nav className="mt-5 flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={cn("-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium transition-colors", active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="tabular rounded-md bg-muted px-1.5 text-2xs">{t.count}</span>}
            </Link>
          );
        })}
      </nav>}
      <ChangeDateDialog open={dateOpen} onOpenChange={setDateOpen} current={project.anchorDate} label={project.anchorLabel} />
    </div>
  );
}

function ChangeDateDialog({ open, onOpenChange, current, label }: { open: boolean; onOpenChange: (o: boolean) => void; current: string; label: string }) {
  const { ws, projectId, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const router = useRouter();
  const [date, setDate] = useState(current);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date !== current;
  const preview = useQuery({ ...trpc.projects.previewAnchorChange.queryOptions({ workspace: ws.slug, projectId, newAnchorDate: date }), enabled: open && valid });
  const change = useMutation(
    trpc.projects.changeAnchorDate.mutationOptions({
      onSuccess: async (r) => {
        await invalidate();
        onOpenChange(false);
        router.refresh();
        toast.success(`${label} moved ${r.deltaDays > 0 ? "+" : ""}${r.deltaDays} days`, { description: `${r.shifted} tasks shifted, ${r.kept} pinned dates kept.` });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setDate(current); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change {label.toLowerCase()}</DialogTitle>
          <DialogDescription>Every task that still follows the template shifts by the same number of days. Dates you set by hand stay pinned.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="new-date">New {label.toLowerCase()}</Label>
          <Input id="new-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tabular w-56" />
        </div>
        {valid && preview.data && (
          <div className="rounded-lg bg-muted p-3 text-xs">
            <div className="flex items-center justify-between font-medium">
              <span>{preview.data.deltaDays > 0 ? "+" : ""}{preview.data.deltaDays} days</span>
              <span className="text-muted-foreground">{preview.data.shifted} shift · {preview.data.kept} pinned</span>
            </div>
            {preview.data.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-warning">
                {preview.data.warnings.slice(0, 4).map((w, i) => <li key={i}>• {w.message}</li>)}
              </ul>
            )}
            <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-muted-foreground">
              {preview.data.preview.slice(0, 12).map((p) => (
                <div key={p.id} className="flex justify-between gap-2"><span className="truncate">{p.title}</span><span className={cn("tabular shrink-0", p.kept && "text-warning")}>{fmtDate(p.dueDate)}{p.kept ? " · pinned" : ""}</span></div>
              ))}
              {preview.data.preview.length > 12 && <div>…and {preview.data.preview.length - 12} more</div>}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || change.isPending} onClick={() => change.mutate({ workspace: ws.slug, projectId, newAnchorDate: date })}>{change.isPending ? "Moving…" : "Move date"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
