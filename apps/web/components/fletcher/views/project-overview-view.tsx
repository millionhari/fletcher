"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, offsetLabel, relativeDays } from "@/lib/format";
import { releaseInfoSchema, todayISO, type ReleaseInfo } from "@fletcher/core";
import { useProjectData, useInvalidateProject } from "@/lib/hooks/use-project-data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SectionHeader } from "@/components/fletcher/page-header";
import { DeliverableStatusBadge } from "@/components/fletcher/status-badge";
import { StatusSelect, AssigneePicker, DatePill } from "@/components/fletcher/task-controls";
import { EmptyState } from "@/components/fletcher/empty-state";

const FIELDS: { key: keyof ReleaseInfo; label: string; mono?: boolean; wide?: boolean; multiline?: boolean; group: "ids" | "links" | "meta" | "copy" }[] = [
  { key: "upc", label: "UPC", mono: true, group: "ids" },
  { key: "isrc", label: "ISRC", mono: true, group: "ids" },
  { key: "appleTrackId", label: "Apple track ID", mono: true, group: "ids" },
  { key: "spotifyUri", label: "Spotify URI", mono: true, group: "ids" },
  { key: "presaveLink", label: "Presave link", group: "links" },
  { key: "retailLink", label: "Retail link", group: "links" },
  { key: "listeningLink", label: "Listening link", group: "links" },
  { key: "artworkFolderUrl", label: "Artwork folder", group: "links" },
  { key: "lyricsUrl", label: "Lyrics doc", group: "links" },
  { key: "genre", label: "Genre", group: "meta" },
  { key: "language", label: "Language", group: "meta" },
  { key: "label", label: "Label", group: "meta" },
  { key: "distributor", label: "Distributor", group: "meta" },
  { key: "releaseTime", label: "Release time", group: "meta" },
  { key: "releaseTimezone", label: "Timezone", group: "meta" },
  { key: "pitchQuote", label: "Pitch quote", multiline: true, wide: true, group: "copy" },
  { key: "spotifyPitchBlurb", label: "Spotify pitch blurb (back end)", multiline: true, wide: true, group: "copy" },
  { key: "dspBio", label: "Shortened DSP bio", multiline: true, wide: true, group: "copy" },
  { key: "lyrics", label: "Lyrics", multiline: true, wide: true, group: "copy" },
];

export function ProjectOverviewView() {
  const { data, isLoading, ws, projectId, trpc } = useProjectData();
  const invalidate = useInvalidateProject();
  const [editing, setEditing] = useState(false);
  const info = useMemo(() => (data ? releaseInfoSchema.parse(data.project.releaseInfo ?? {}) : ({} as ReleaseInfo)), [data]);
  const [draft, setDraft] = useState<ReleaseInfo>({});
  const save = useMutation(trpc.projects.update.mutationOptions({ onSuccess: async () => { await invalidate(); setEditing(false); toast.success("Release info saved"); }, onError: (e) => toast.error(e.message) }));

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;
  const { project, tasks, deliverables, children } = data;
  const base = `/w/${ws.slug}/projects/${projectId}`;
  const open = tasks.filter((t) => t.status !== "done");
  const next = open.filter((t) => t.dueDate).slice(0, 7);
  const reviewables = deliverables.filter((d) => !d.specKey);
  const isRelease = ["single", "album", "ep"].includes(project.type);
  const today = todayISO();
  const filled = FIELDS.filter((f) => f.key !== "tracklist" && info[f.key]);
  const tracklist = info.tracklist ?? [];

  return (
    <div className="fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        {isRelease && (
          <section>
            <SectionHeader title="Release info" actions={<Button variant="ghost" size="xs" onClick={() => { setDraft(info); setEditing(true); }}><Pencil />Edit</Button>} />
            <div className="surface p-4">
              {filled.length === 0 ? (
                <p className="text-xs text-muted-foreground">No UPC, ISRC, links or pitch copy yet. Add them so the team pulls from one place.</p>
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
                      <li key={i} className="flex items-center gap-2 text-[13px]"><span className="tabular w-5 text-2xs text-muted-foreground">{i + 1}</span>{t.title}{t.isFocusTrack && <span className="rounded bg-brand-soft px-1 text-2xs font-medium text-brand">focus</span>}{t.featuredArtists?.length ? <span className="text-muted-foreground">ft. {t.featuredArtists.join(", ")}</span> : null}</li>
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
                <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="tabular w-14 shrink-0 font-mono text-2xs text-muted-foreground">{offsetLabel(t.dueDate, project.anchorDate)}</span>
                  <div className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.title}</div>
                  <StatusSelect taskId={t.id} status={t.status} />
                  <DatePill taskId={t.id} dueDate={t.dueDate} isOverridden={t.isDateOverridden} overdue={!!t.dueDate && t.dueDate < today} />
                  <AssigneePicker taskId={t.id} assigneeMemberId={t.assigneeMemberId} assigneeName={t.assigneeName} roleKey={t.roleKey} />
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
        <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Release info</SheetTitle>
            <SheetDescription>Identifiers, links and pitch copy for {project.name}.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4 pb-4">
            {(["ids", "links", "meta", "copy"] as const).map((g) => (
              <div key={g} className="grid gap-3">
                <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{{ ids: "Identifiers", links: "Links", meta: "Metadata", copy: "Copy" }[g]}</div>
                <div className="grid grid-cols-2 gap-3">
                  {FIELDS.filter((f) => f.group === g).map((f) => (
                    <div key={f.key} className={f.wide ? "col-span-2 grid gap-1" : "grid gap-1"}>
                      <Label htmlFor={`ri-${f.key}`} className="text-xs">{f.label}</Label>
                      {f.multiline ? (
                        <Textarea id={`ri-${f.key}`} rows={f.key === "lyrics" ? 8 : 4} value={(draft[f.key] as string) ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                      ) : (
                        <Input id={`ri-${f.key}`} className={f.mono ? "font-mono" : undefined} value={(draft[f.key] as string) ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate({ workspace: ws.slug, projectId, releaseInfo: Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, typeof v === "string" ? (v.trim() === "" ? undefined : v) : v])) })}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
