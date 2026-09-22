"use client";

import { cn } from "@/lib/utils";

/** The pill used by every list filter row (Overview work list, Timeline). */
export function chipClass(active: boolean): string {
  return cn("box-border inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0 text-xs font-medium leading-none transition-colors", active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground");
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={chipClass(active)}>
      {children}
    </button>
  );
}
