"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";

export interface UploadResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  publicUrl: string;
}

type Dims = { width: number | null; height: number | null; durationSeconds: number | null };

/** Read dimensions / duration in the browser so the server never has to open the file. */
async function probeMedia(file: File): Promise<Dims> {
  const none: Dims = { width: null, height: null, durationSeconds: null };
  if (file.type.startsWith("image/")) {
    try {
      const bmp = await createImageBitmap(file);
      const out = { width: bmp.width, height: bmp.height, durationSeconds: null };
      bmp.close();
      return out;
    } catch {
      return none;
    }
  }
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) return none;
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio") as HTMLVideoElement;
    const url = URL.createObjectURL(file);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      resolve({ width: el.videoWidth || null, height: el.videoHeight || null, durationSeconds: Number.isFinite(el.duration) ? el.duration : null });
      URL.revokeObjectURL(url);
    };
    el.onerror = () => { resolve(none); URL.revokeObjectURL(url); };
    el.src = url;
  });
}

/** PUT with progress — fetch can't report upload progress, so this is XHR. */
function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(file);
  });
}

/**
 * The upload flow every caller shares: reserve (quota + plan checks happen
 * here and surface as the thrown message), send the bytes, finalize.
 */
export function useUploader() {
  const trpc = useTRPC();
  const ws = useWorkspace();
  const create = useMutation(trpc.files.createUpload.mutationOptions());
  const finalize = useMutation(trpc.files.finalizeUpload.mutationOptions());

  const upload = async (file: File, folder: string, onProgress?: (fraction: number) => void): Promise<UploadResult> => {
    const dims = await probeMedia(file);
    const res = await create.mutateAsync({ workspace: ws.slug, fileName: file.name, mimeType: file.type, bytes: file.size, folder });
    if (res.mode === "signed") {
      await putWithProgress(res.url, file, { authorization: `Bearer ${res.token}`, "content-type": file.type || "application/octet-stream", "x-upsert": "false" }, onProgress);
    } else {
      const form = new FormData();
      form.append("file", file);
      form.append("fileId", res.fileId);
      const r = await fetch(res.url, { method: "POST", body: form });
      if (!r.ok) throw new Error(`Upload failed (${r.status})`);
      onProgress?.(1);
    }
    const row = await finalize.mutateAsync({ workspace: ws.slug, fileId: res.fileId, ...dims });
    return { fileId: row.id, fileName: row.fileName, mimeType: row.mimeType, bytes: row.bytes, width: row.width, height: row.height, durationSeconds: row.durationSeconds, publicUrl: `/api/files/${row.storageKey}` };
  };
  return { upload };
}

export function UploadDropzone({ folder, accept, hint, onUploaded, value, compact, className }: { folder: string; accept?: string;
  /** Line under the prompt; callers pass something specific to what they accept. */
  hint?: string; onUploaded: (r: UploadResult | null) => void; value?: UploadResult | null; compact?: boolean; className?: string }) {
  const ws = useWorkspace();
  const { upload } = useUploader();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setProgress(0);
    setError(null);
    try {
      onUploaded(await upload(file, folder, setProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
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

  const busy = progress !== null;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files[0]); }}
      onClick={() => !busy && inputRef.current?.click()}
      className={cn("relative flex cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed border-border text-center transition-colors hover:border-foreground/40 hover:bg-muted/40", compact ? "px-3 py-3" : "px-4 py-6", drag && "border-brand bg-brand-soft", className)}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
      <UploadCloud className={cn("text-muted-foreground", compact ? "size-4" : "size-5")} />
      <div className="text-xs font-medium">{busy ? `Uploading… ${Math.round((progress ?? 0) * 100)}%` : "Drop a file or click to browse"}</div>
      {!compact && !error && <div className="text-2xs text-muted-foreground">{hint ?? "Kept with the workspace's files."}</div>}
      {error && (
        <div className="text-2xs text-danger">
          {error}
          {/upgrade|storage limit|free up/i.test(error) && <> · <Link href={`/w/${ws.slug}/files`} onClick={(e) => e.stopPropagation()} className="underline">Files</Link></>}
        </div>
      )}
      {busy && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand transition-[width]" style={{ width: `${(progress ?? 0) * 100}%` }} />}
    </div>
  );
}
