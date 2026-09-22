"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, FileAudio, FileImage, FileText, FileVideo, File as FileIcon, HardDrive, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@fletcher/core";
import { fmtDateYear } from "@/lib/format";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, SectionHeader } from "@/components/fletcher/page-header";
import { EmptyState } from "@/components/fletcher/empty-state";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { FilterChip } from "@/components/fletcher/filter-chip";
import { UsageMeter } from "@/components/fletcher/usage-meter";
import { Pill } from "@/components/fletcher/status-badge";

type Sort = "size" | "date" | "name";
type Dir = "asc" | "desc";
type FileType = "video" | "image" | "audio" | "document" | "other";

const TYPE_ICON: Record<FileType, React.ComponentType<{ className?: string }>> = { video: FileVideo, image: FileImage, audio: FileAudio, document: FileText, other: FileIcon };
const TYPE_LABEL: Record<FileType, string> = { video: "Video", image: "Image", audio: "Audio", document: "Document", other: "Other" };

export function FilesView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [sort, setSort] = useState<Sort>("date");
  const [dir, setDir] = useState<Dir>("desc");
  const [type, setType] = useState<FileType | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const usage = useQuery(trpc.files.usage.queryOptions({ workspace: ws.slug }));
  const q = useQuery(trpc.files.list.queryOptions({ workspace: ws.slug, sort, dir, type: type ?? undefined, search: search.trim() || undefined }));
  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: trpc.files.pathKey() }), qc.invalidateQueries({ queryKey: trpc.deliverables.pathKey() }), qc.invalidateQueries({ queryKey: trpc.taskDetail.pathKey() })]);
  const del = useMutation(trpc.files.delete.mutationOptions({ onSuccess: async () => { await invalidate(); setPendingDelete(null); toast.success("File deleted"); }, onError: (e) => toast.error(e.message) }));

  const rows = q.data ?? [];
  const target = useMemo(() => rows.find((r) => r.id === pendingDelete) ?? null, [rows, pendingDelete]);
  const toggleSort = (s: Sort) => { if (sort === s) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(s); setDir(s === "name" ? "asc" : "desc"); } };
  const sortIcon = (s: Sort) => (sort === s ? (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : null);
  const base = `/w/${ws.slug}`;

  return (
    <div className="fade-in-up">
      <PageHeader title="Files" description="Everything stored in this workspace — deliverable versions, task attachments and the profile kit. Delete here to free up space." />

      {usage.data ? (
        <UsageMeter className="mb-6" usedBytes={usage.data.usedBytes} quotaBytes={usage.data.quotaBytes} plan={usage.data.plan} overQuota={usage.data.overQuota} onFreeUp={() => { setSort("size"); setDir("desc"); setType(null); }} />
      ) : (
        <Skeleton className="mb-6 h-20 rounded-xl" />
      )}

      <SectionHeader
        title="Stored files"
        count={q.data ? rows.length : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-1">
            <div className="relative mr-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files" className="h-7 w-44 pl-7 text-xs" />
            </div>
            <FilterChip active={type === null} onClick={() => setType(null)}>All</FilterChip>
            {(Object.keys(TYPE_LABEL) as FileType[]).map((t) => <FilterChip key={t} active={type === t} onClick={() => setType(type === t ? null : t)}>{TYPE_LABEL[t]}</FilterChip>)}
          </div>
        }
      />

      {q.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<HardDrive />} title={search || type ? "Nothing matches" : "No files yet"} description={search || type ? "Try a different filter." : "Files land here as you upload deliverable versions, attach files to tasks, or fill the profile kit."} />
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[38%]"><button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-foreground">Name {sortIcon("name")}</button></TableHead>
                <TableHead>Used in</TableHead>
                <TableHead><button onClick={() => toggleSort("size")} className="inline-flex items-center gap-1 hover:text-foreground">Size {sortIcon("size")}</button></TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead><button onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 hover:text-foreground">Added {sortIcon("date")}</button></TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => {
                const Icon = TYPE_ICON[f.type];
                const u = f.usedIn;
                const href = u?.kind === "version" ? `${base}/deliverables/${u.deliverableId}` : u?.kind === "attachment" ? `${base}/projects/${u.projectId}?task=${u.taskId}` : null;
                return (
                  <TableRow key={f.id} className="group/row">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-3.5" /></span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{f.fileName}</span>
                            {f.status === "importing" && <Pill tone="info" dot={false}><Loader2 className="size-2.5 animate-spin" />Importing</Pill>}
                            {f.status === "failed" && <Pill tone="danger" dot={false}>Failed</Pill>}
                          </div>
                          <div className="truncate text-2xs text-muted-foreground">{TYPE_LABEL[f.type]}{f.width && f.height ? ` · ${f.width}×${f.height}` : ""}{f.durationSeconds ? ` · ${Math.round(f.durationSeconds)}s` : ""}{f.origin !== "upload" && f.origin !== "seed" ? ` · from ${f.origin.replace("_", " ")}` : ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u ? (
                        <div className="min-w-0">
                          {href ? <Link href={href} className="block max-w-[240px] truncate font-medium hover:underline">{u.kind === "version" ? `${u.deliverableTitle} · v${u.versionNumber}` : u.taskTitle}</Link> : <span className="font-medium">{u.kind === "version" ? u.deliverableTitle : u.taskTitle}</span>}
                          <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                            {u.kind === "version" && u.isProfileKit ? <Link href={`${base}/assets`} className="hover:underline">Profile kit</Link> : u.projectName ? <><span className="size-2 shrink-0 rounded-[3px]" style={{ background: u.projectColor ?? undefined }} /><span className="truncate">{u.projectName}</span></> : "—"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not attached</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap">{fmtBytes(f.bytes)}</TableCell>
                    <TableCell>{f.uploaderName ? <span className="flex items-center gap-2"><MemberAvatar name={f.uploaderName} size="xs" showTooltip={false} /><span className="truncate">{f.uploaderName}</span></span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateYear(f.createdAt.toISOString().slice(0, 10))}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
                        {f.status === "ready" && <Button asChild variant="ghost" size="icon-xs" aria-label="Open file"><a href={f.publicUrl} target="_blank" rel="noreferrer"><ExternalLink /></a></Button>}
                        <Button variant="ghost" size="icon-xs" aria-label="Delete file" className="text-muted-foreground hover:text-danger" onClick={() => setPendingDelete(f.id)}><Trash2 /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {target?.fileName}?</DialogTitle>
            <DialogDescription>
              {target?.usedIn?.kind === "version" ? `This removes v${target.usedIn.versionNumber} of "${target.usedIn.deliverableTitle}" and every comment on it.` : target?.usedIn?.kind === "attachment" ? `This removes the attachment from "${target.usedIn.taskTitle}".` : "This file isn't attached to anything."} It frees {target ? fmtBytes(target.bytes) : ""} and can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={del.isPending} onClick={() => target && del.mutate({ workspace: ws.slug, fileId: target.id })}>{del.isPending && <Loader2 className="animate-spin" />}Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
