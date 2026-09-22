"use client";

import Link from "next/link";
import { AlertTriangle, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBytes, PLAN_LABELS, type Plan } from "@fletcher/core";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/fletcher/status-badge";

/** "12 GB of 100 GB" with the plan, and the over-limit state when uploads are paused. */
export function UsageMeter({ usedBytes, quotaBytes, plan, overQuota, onFreeUp, compact, className }: { usedBytes: number; quotaBytes: number; plan: string; overQuota: boolean; onFreeUp?: () => void; compact?: boolean; className?: string }) {
  const pct = Math.min(100, (usedBytes / quotaBytes) * 100);
  const near = !overQuota && pct >= 85;
  return (
    <div className={cn(compact ? "" : "surface p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <HardDrive className="size-3.5 text-muted-foreground" />
          <span className="tabular font-medium">{fmtBytes(usedBytes)}</span>
          <span className="text-muted-foreground">of {fmtBytes(quotaBytes)}</span>
          <Pill tone={plan === "free" ? "neutral" : "brand"} dot={false}>{PLAN_LABELS[plan as Plan] ?? plan}</Pill>
        </div>
        {!compact && <span className="tabular text-2xs text-muted-foreground">{Math.round(pct)}%</span>}
      </div>
      <Progress value={pct} className={cn("mt-2 h-1.5", overQuota && "[&>[data-slot=progress-indicator]]:bg-danger", near && "[&>[data-slot=progress-indicator]]:bg-warning")} />
      {overQuota && !compact && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">You&apos;re over your storage limit.</div>
            <div className="mt-0.5 text-danger/80">Uploads are paused until you free up space or upgrade. Everything already here still opens.</div>
          </div>
          {onFreeUp && <Button size="xs" variant="outline" className="shrink-0" onClick={onFreeUp}>Free up space</Button>}
        </div>
      )}
      {!overQuota && !compact && plan === "free" && (
        <p className="mt-2 text-2xs text-muted-foreground">Free workspaces get 2 GB and link video from YouTube or Vimeo. <Link href="#" className="underline hover:text-foreground">Upgrade</Link> for 100 GB and video uploads.</p>
      )}
    </div>
  );
}
