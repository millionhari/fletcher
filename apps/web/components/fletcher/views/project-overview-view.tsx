"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, offsetLabel, relativeDays } from "@/lib/format";
import { releaseInfoSchema, todayISO, type ReleaseInfo } from "@fletcher/core";
import { useProjectData, useInvalidateProject } from "@/lib/hooks/use-project-data";
import { useTaskParam } from "@/lib/hooks/use-task-param";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RELEASE_INFO_FIELDS as FIELDS, ReleaseInfoForm } from "@/components/fletcher/release-info-form";
import { SectionHeader } from "@/components/fletcher/page-header";
import { DeliverableStatusBadge } from "@/components/fletcher/status-badge";
import { StatusSelect, AssigneePicker, DatePill } from "@/components/fletcher/task-controls";
import { EmptyState } from "@/components/fletcher/empty-state";

export function ProjectOverviewView() {
  const { data, isLoading, ws, projectId, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [editing, setEditing] = useState(false);
  const { setTaskId } = useTaskParam();
  const info = useMemo(() => (data ? releaseInfoSchema.parse(data.project.releaseInfo ?? {}) : ({} as ReleaseInfo)), [data]);
  const save = useMutation(trpc.projects.update.mutationOptions({ onSuccess: async () => { await invalidate(); setEditing(false); toast.success("Release info saved"); }, onError: (e) => toast.error(e.message) }));

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;
  const { project, tasks, deliverables, children } = data;
  const base = `/w/${ws.slug}/projects/${projectId}`;
  const open = tasks.filter((t) => t.status !== "done");
  const next = open.filter((t) => t.dueDate).slice(0, 7);
  const reviewables = deliverables.filter((d) => !d.specKey);
  const isRelease = ["single", "album", "ep"].includes(project.type);
  const today = todayISO();
  const filled = FIELDS.filter((f) => info[f.key]);
  const tracklist = info.tracklist ?? [];
  const featured = info.featuredArtists ?? [];
  const hasInfo = filled.length > 0 || tracklist.length > 0 || featured.length > 0;

  return (
    <div className="fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        {isRelease && (
          <section>
            <SectionHeader title="Release info" actions={<Button variant="ghost" size="xs" onClick={() => setEditing(true)}><Pencil />Edit</Button>} />
            <div className="surface p-4">
              {!hasInfo ? (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground">No identifiers, metadata, tracklist or pitch copy yet. Add them so the team pulls from one place.</p>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditing(true)}><Plus />Add release info</Button>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                  {filled.filter((f) => !f.multiline).map((f) => (
                    <div key={f.key} className="min-w-0">
                      <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{f.label}</dt>
                      <dd className={f.mono ? "tabular truncate font-mono text-xs" : "truncate text-[13px]"}>
                        {String(info[f.key]).startsWith("http") ? <a href={String(info[f.key])} target="_blank" rel="noreferrer" className="text-brand hover:underline">{String(info[f.key])}</a> : String(info[f.key])}
                      </dd>
                    </div>
                  ))}
                  {featured.length > 0 && (
                    <div className="min-w-0">
                      <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Featured artists</dt>
                      <dd className="truncate text-[13px]">{featured.join(", ")}</dd>
                    </div>
                  )}
                </dl>
              )}
              {filled.some((f) => f.multiline) && (
                <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                  {filled.filter((f) => f.multiline).map((f) => (
                    <div key={f.key}>
                      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{f.label}</div>
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-foreground/90 line-clamp-6">{String(info[f.key])}</p>
                    </div>
                  ))}
                </div>
              )}
              {tracklist.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="mb-1.5 text-2xs uppercase tracking-wider text-muted-foreground">Tracklist</div>
                  <ol className="grid gap-y-1 md:grid-cols-2">
                    {tracklist.map((t, i) => (
                      <li key={i} className="flex items-center gap-2 text-[13px]"><span className="tabular w-5 text-2xs text-muted-foreground">{i + 1}</span>{t.title}{t.isFocusTrack && <span className="rounded bg-brand-soft px-1 text-2xs font-medium text-brand">focus</span>}{t.featuredArtists?.length ? <span className="text-muted-foreground">ft. {t.featuredArtists.join(", ")}</span> : null}{t.isrc && <span className="tabular ml-auto pr-4 font-mono text-2xs text-muted-foreground">{t.isrc}</span>}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <SectionHeader title="Up next" count={open.length} actions={<Button asChild variant="ghost" size="xs"><Link href={`${base}/timeline`}>Timeline <ArrowRight /></Link></Button>} />
          {next.length === 0 ? (
            <EmptyState title="Everything is done" description="No open tasks remain on this project." />
          ) : (
            <div className="surface divide-y divide-border">
              {next.map((t) => (
                <div key={t.id} onClick={() => setTaskId(t.id)} className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40">
                  <span className="tabular w-14 shrink-0 font-mono text-2xs text-muted-foreground">{offsetLabel(t.dueDate, project.anchorDate)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.title}</span>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect taskId={t.id} status={t.status} />
                    <DatePill taskId={t.id} dueDate={t.dueDate} isOverridden={t.isDateOverridden} overdue={!!t.dueDate && t.dueDate < today} />
                    <AssigneePicker taskId={t.id} assigneeMemberId={t.assigneeMemberId} assigneeName={t.assigneeName} roleKey={t.roleKey} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-8">
        <section>
          <SectionHeader title="Deliverables" count={reviewables.length} actions={<Button asChild variant="ghost" size="xs"><Link href={`${base}/deliverables`}>All <ArrowRight /></Link></Button>} />
          {reviewables.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">Nothing to review yet.</p>
          ) : (
            <div className="surface divide-y divide-border">
              {reviewables.slice(0, 8).map((d) => (
                <Link key={d.id} href={`/w/${ws.slug}/deliverables/${d.id}`} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/60">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{d.title}</span>
                  {d.latestVersion && <span className="tabular text-2xs text-muted-foreground">v{d.latestVersion.versionNumber}</span>}
                  <DeliverableStatusBadge status={d.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
        {children.length > 0 && (
          <section>
            <SectionHeader title="Child projects" count={children.length} />
            <div className="surface divide-y divide-border">
              {children.map((c) => (
                <Link key={c.id} href={`/w/${ws.slug}/projects/${c.id}`} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/60">
                  <span className="size-2 rounded-[3px]" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{c.name}</span>
                  <span className="tabular text-xs text-muted-foreground">{fmtDate(c.anchorDate)} · {relativeDays(c.anchorDate)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {project.notes && (
          <section>
            <SectionHeader title="Notes" />
            <p className="surface whitespace-pre-line p-4 text-[13px] leading-5">{project.notes}</p>
          </section>
        )}
      </div>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="overflow-y-auto data-[side=right]:w-[560px] data-[side=right]:sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle>Release info</SheetTitle>
            <SheetDescription>Identifiers, metadata, tracklist and pitch copy for {project.name}.</SheetDescription>
          </SheetHeader>
          <ReleaseInfoForm info={info} showTracklist={project.type !== "single" || tracklist.length > 0} saving={save.isPending} onCancel={() => setEditing(false)} onSave={(releaseInfo) => save.mutate({ workspace: ws.slug, projectId, releaseInfo })} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
