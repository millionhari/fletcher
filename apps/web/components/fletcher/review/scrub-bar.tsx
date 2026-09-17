"use client";

import { cn } from "@/lib/utils";
import { formatTimestamp } from "@fletcher/core";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface Marker {
  id: string;
  seconds: number;
  label: string;
  resolved: boolean;
  authorName: string | null;
}

/** Custom timeline strip under the player: playhead + comment markers. */
export function ScrubBar({ duration, current, markers, onSeek, activeId }: { duration: number; current: number; markers: Marker[]; onSeek: (s: number) => void; activeId?: string | null }) {
  const pct = (s: number) => (duration > 0 ? Math.min(100, Math.max(0, (s / duration) * 100)) : 0);
  return (
    <div className="mt-3 select-none">
      <div className="relative h-8 cursor-pointer" onClick={(e) => { if (!duration) return; const r = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * duration); }}>
        <div className="absolute inset-x-0 top-3.5 h-1 rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground/70" style={{ width: `${pct(current)}%` }} />
        </div>
        <div className="absolute top-2 -ml-px h-4 w-0.5 rounded bg-foreground" style={{ left: `${pct(current)}%` }} />
        {markers.map((m) => (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); onSeek(m.seconds); }}
                className={cn("absolute top-0 -ml-1.5 size-3 rounded-full border-2 border-background transition-transform hover:scale-125", m.resolved ? "bg-success" : "bg-brand", activeId === m.id && "scale-125 ring-2 ring-brand/40")}
                style={{ left: `${pct(m.seconds)}%` }}
                aria-label={`Comment at ${formatTimestamp(m.seconds)}`}
              />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><span className="font-mono text-2xs">{formatTimestamp(m.seconds)}</span> · {m.authorName ?? "?"}: {m.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex justify-between font-mono text-2xs text-muted-foreground">
        <span>{formatTimestamp(current)}</span>
        <span>{duration ? formatTimestamp(duration) : "—"}</span>
      </div>
    </div>
  );
}
