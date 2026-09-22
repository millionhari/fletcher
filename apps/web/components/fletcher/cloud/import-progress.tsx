"use client";

import { AlertTriangle, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { fmtBytes } from "@fletcher/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type FileState = { status: "pending" | "importing" | "ready" | "failed"; progressBytes: number; totalBytes: number | null; error: string | null } | null | undefined;

/** Where a copy-in stands, shown in place of the thing that's arriving. */
export function ImportProgress({ file, fileName, origin, onRetry, onDelete, compact, className }: { file: FileState; fileName?: string | null; origin?: string | null; onRetry?: () => void; onDelete?: () => void; compact?: boolean; className?: string }) {
  if (!file || file.status === "ready") return null;
  const from = origin && origin !== "upload" && origin !== "seed" ? origin.replace("_", " ").replace("share link", "the shared link") : null;
  if (file.status === "failed") {
    return (
      <div className={cn("flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger", className)}>
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">Couldn&apos;t copy {fileName ?? "this file"} in</div>
          {file.error && <div className="mt-0.5 text-danger/80">{file.error}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onRetry && <Button size="xs" variant="outline" onClick={onRetry}><RotateCcw />Retry</Button>}
          {onDelete && <Button size="xs" variant="ghost" onClick={onDelete}><Trash2 />Remove</Button>}
        </div>
      </div>
    );
  }
  const pct = file.totalBytes ? Math.min(100, (file.progressBytes / file.totalBytes) * 100) : null;
  return (
    <div className={cn("rounded-lg border border-border bg-muted/40 px-3 py-2", compact ? "" : "px-4 py-3", className)}>
      <div className="flex items-center gap-2 text-xs">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-brand" />
        <span className="min-w-0 flex-1 truncate font-medium">Copying {fileName ?? "file"}{from ? ` from ${from}` : ""}…</span>
        <span className="tabular shrink-0 text-2xs text-muted-foreground">{pct != null ? `${Math.round(pct)}%` : fmtBytes(file.progressBytes)}</span>
      </div>
      <Progress value={pct ?? undefined} className="mt-2 h-1" />
    </div>
  );
}
