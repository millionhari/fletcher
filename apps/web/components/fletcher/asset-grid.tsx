"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Info, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@/lib/format";
import { describeSpec, type AssetScope, type AssetSpec } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpecStatusPill } from "@/components/fletcher/status-badge";
import { uploadFile } from "@/components/fletcher/upload-dropzone";
import { SectionHeader } from "@/components/fletcher/page-header";
import { ProgressBar } from "@/components/fletcher/progress-ring";

const GROUP_TITLES: Record<AssetSpec["group"], string> = { profile: "Profile images", banner: "Banners & headers", dsp: "DSP", canvas: "Canvas & motion", ads: "Ad cutdowns", press: "Photos", artwork: "Artwork & brand", misc: "Other" };
const GROUP_ORDER: AssetSpec["group"][] = ["profile", "banner", "dsp", "canvas", "artwork", "press", "ads", "misc"];

/** Spec-driven asset slots. Each slot is a deliverable with a specKey; upload probes dimensions and checks them. */
export function AssetGrid({ scope, projectId, title, description }: { scope: AssetScope; projectId?: string | null; title: string; description?: string }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(trpc.deliverables.assetSlots.queryOptions({ workspace: ws.slug, scope, projectId: projectId ?? null }));
  const ensure = useMutation(trpc.deliverables.ensureSlot.mutationOptions());
  const addVersion = useMutation(trpc.deliverables.addVersion.mutationOptions());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.deliverables.assetSlots.queryKey({ workspace: ws.slug, scope, projectId: projectId ?? null }) });

  const upload = async (spec: AssetSpec, file: File) => {
    setBusyKey(spec.key);
    try {
      const { deliverableId } = await ensure.mutateAsync({ workspace: ws.slug, scope, specKey: spec.key, projectId: projectId ?? null });
      const r = await uploadFile(file, `assets/${scope}/${spec.key}`);
      await addVersion.mutateAsync({ workspace: ws.slug, deliverableId, upload: { storageKey: r.storageKey, fileName: r.fileName, mimeType: r.mimeType, bytes: r.bytes, width: r.width, height: r.height, durationSeconds: r.durationSeconds } });
      await invalidate();
      toast.success(`${spec.label} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyKey(null);
    }
  };

  if (q.isLoading || !q.data) return <Skeleton className="h-96 rounded-xl" />;
  const slots = q.data;
  const ok = slots.filter((s) => s.version?.check.status === "ok").length;
  const groups = GROUP_ORDER.map((g) => ({ g, items: slots.filter((s) => s.spec.group === g) })).filter((x) => x.items.length);

  return (
    <div className="fade-in-up">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="w-48 shrink-0">
          <div className="mb-1 flex justify-between text-2xs text-muted-foreground"><span>Meets spec</span><span className="tabular">{ok}/{slots.length}</span></div>
          <ProgressBar value={slots.length ? (ok / slots.length) * 100 : 0} tone="success" />
        </div>
      </div>
      <div className="space-y-8">
        {groups.map(({ g, items }) => (
          <section key={g}>
            <SectionHeader title={GROUP_TITLES[g]} count={items.length} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {items.map((slot) => <SpecSlot key={slot.spec.key} slot={slot} busy={busyKey === slot.spec.key} onFile={(f) => upload(slot.spec, f)} wsSlug={ws.slug} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

type Slot = { spec: AssetSpec; deliverableId: string | null; status: string | null; version: { publicUrl: string | null; width: number | null; height: number | null; bytes: number | null; mimeType: string | null; fileName: string | null; check: { status: "ok" | "wrong_dimensions" | "too_large" | "too_long" | "too_short" | "unknown"; message: string; expected: string; actual: string } } | null };

function SpecSlot({ slot, busy, onFile, wsSlug }: { slot: Slot; busy: boolean; onFile: (f: File) => void; wsSlug: string }) {
  const [drag, setDrag] = useState(false);
  const { spec, version } = slot;
  const aspect = spec.width && spec.height ? spec.width / spec.height : spec.minWidth && spec.minHeight ? spec.minWidth / spec.minHeight : spec.aspect ?? 1;
  const isImage = version?.mimeType?.startsWith("image/");
  const status = version ? version.check.status : "missing";
  const accept = spec.mediaType === "video" ? "video/*,image/*" : spec.mediaType === "image" ? "image/*" : undefined;

  return (
    <div className={cn("surface group flex flex-col overflow-hidden transition-shadow", drag && "ring-2 ring-brand")} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
      <label className="relative block cursor-pointer bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-[size:12px_12px]">
        <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <div className="flex items-center justify-center p-3" style={{ aspectRatio: Math.min(Math.max(aspect, 0.6), 3) }}>
          {version?.publicUrl && isImage ? (
            <img src={version.publicUrl} alt={spec.label} className={cn("max-h-full max-w-full rounded shadow-hairline object-contain", spec.key.startsWith("profile_") && "rounded-full")} />
          ) : version?.publicUrl && version.mimeType?.startsWith("video/") ? (
            <video src={version.publicUrl} muted loop playsInline className="max-h-full max-w-full rounded" onMouseOver={(e) => e.currentTarget.play()} onMouseOut={(e) => e.currentTarget.pause()} />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <UploadCloud className="size-4" />
              <span className="text-2xs">{busy ? "Uploading…" : "Drop or click"}</span>
            </div>
          )}
        </div>
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs">Uploading…</div>}
      </label>
      <div className="flex flex-col gap-1.5 border-t border-border px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{spec.label}</div>
            <div className="tabular truncate font-mono text-2xs text-muted-foreground">{describeSpec(spec)}</div>
          </div>
          {spec.notes && (
            <Tooltip><TooltipTrigger className="text-muted-foreground"><Info className="size-3.5" /></TooltipTrigger><TooltipContent className="max-w-xs">{spec.notes}</TooltipContent></Tooltip>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <SpecStatusPill status={status} />
          {version && (
            <span className="tabular truncate text-2xs text-muted-foreground">{version.width && version.height ? `${version.width}×${version.height}` : ""}{version.bytes ? ` · ${fmtBytes(version.bytes)}` : ""}</span>
          )}
        </div>
        {version && version.check.status !== "ok" && <p className="text-2xs leading-4 text-danger">{version.check.message}</p>}
        {slot.deliverableId && (
          <Link href={`/w/${wsSlug}/deliverables/${slot.deliverableId}`} className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"><ExternalLink className="size-3" />Versions & notes</Link>
        )}
      </div>
    </div>
  );
}
