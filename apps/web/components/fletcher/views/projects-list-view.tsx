"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { fmtDateYear, pct, relativeDays } from "@/lib/format";
import { PROJECT_TYPE_LABELS } from "@fletcher/core";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/fletcher/page-header";
import { ProjectStatusBadge } from "@/components/fletcher/status-badge";
import { ProgressBar } from "@/components/fletcher/progress-ring";
import { EmptyState } from "@/components/fletcher/empty-state";

export function ProjectsListView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.projects.list.queryOptions({ workspace: ws.slug, includeArchived: true }));
  const base = `/w/${ws.slug}`;

  return (
    <div className="fade-in-up">
      <PageHeader title="Projects" description="Releases, videos and tours. Each one carries its own timeline, deliverables and comms plan." actions={<Button asChild size="sm"><Link href={`${base}/projects/new`}><Plus />New project</Link></Button>} />
      {isLoading || !data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data.length === 0 ? (
        <EmptyState title="No projects yet" description="Start with a single or an album and Fletcher will build the timeline from the template." action={<Button asChild size="sm"><Link href={`${base}/projects/new`}>New project</Link></Button>} />
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[38%]">Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Anchor date</TableHead>
                <TableHead className="w-40">Progress</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`${base}/projects/${p.id}`} className="flex items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
                      <span className="font-medium">{p.name}</span>
                      {p.parentProjectId && <span className="text-2xs text-muted-foreground">child</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{PROJECT_TYPE_LABELS[p.type]}</TableCell>
                  <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
                  <TableCell>
                    <span className="tabular">{fmtDateYear(p.anchorDate)}</span>
                    <span className="ml-2 text-2xs text-muted-foreground">{relativeDays(p.anchorDate)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={pct(p.doneCount, p.taskCount)} className="w-24" />
                      <span className="tabular text-2xs text-muted-foreground">{p.doneCount}/{p.taskCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right">{p.overdueCount > 0 ? <span className="font-medium text-danger">{p.overdueCount}</span> : <span className="text-muted-foreground">0</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
