"use client";

import { useRef, useState } from "react";
import { CheckCircle2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@/lib/format";

export interface UploadResult {
  storageKey: string;
  fileName: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  publicUrl: string;
}

/** Read duration + dimensions from a video/audio file in the browser before uploading. */
async function probeMedia(file: File): Promise<{ width: number | null; height: number | null; durationSeconds: number | null }> {
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) return { width: null, height: null, durationSeconds: null };
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio") as HTMLVideoElement;
    const url = URL.createObjectURL(file);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      resolve({ width: el.videoWidth || null, height: el.videoHeight || null, durationSeconds: Number.isFinite(el.duration) ? el.duration : null });
      URL.revokeObjectURL(url);
    };
    el.onerror = () => { resolve({ width: null, height: null, durationSeconds: null }); URL.revokeObjectURL(url); };
    el.src = url;
  });
}

export async function uploadFile(file: File, folder: string): Promise<UploadResult> {
  const meta = await probeMedia(file);
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  if (meta.width) form.append("width", String(meta.width));
  if (meta.height) form.append("height", String(meta.height));
  if (meta.durationSeconds) form.append("durationSeconds", String(meta.durationSeconds));
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return (await res.json()) as UploadResult;
}

export function UploadDropzone({ folder, accept, hint, onUploaded, value, compact, className }: { folder: string; accept?: string;
  /** Line under the prompt; callers pass something specific to what they accept. */
  hint?: string; onUploaded: (r: UploadResult | null) => void; value?: UploadResult | null; compact?: boolean; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadFile(file, folder));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className={cn("flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2", className)}>
        <CheckCircle2 className="size-4 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{value.fileName}</div>
          <div className="truncate text-2xs text-muted-foreground">{fmtBytes(value.bytes)}{value.width && value.height ? ` · ${value.width}×${value.height}` : ""}{value.durationSeconds ? ` · ${Math.round(value.durationSeconds)}s` : ""}</div>
        </div>
        <button onClick={() => onUploaded(null)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Remove"><X className="size-4" /></button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current?.click()}
      className={cn("flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-center transition-colors hover:border-foreground/40 hover:bg-muted/40", compact ? "px-3 py-4" : "px-6 py-8", drag && "border-brand bg-brand-soft", className)}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
      <UploadCloud className={cn("text-muted-foreground", compact ? "size-4" : "size-5")} />
      <div className="text-xs font-medium">{busy ? "Uploading…" : "Drop a file or click to browse"}</div>
      {!compact && <div className="text-2xs text-muted-foreground">{hint ?? "Stored locally for now."}</div>}
      {error && <div className="text-2xs text-danger">{error}</div>}
    </div>
  );
}
