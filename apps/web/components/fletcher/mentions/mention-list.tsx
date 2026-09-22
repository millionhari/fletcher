"use client";

import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { cn } from "@/lib/utils";
import { MEMBER_ROLE_LABELS, type MemberRole } from "@fletcher/core";
import { MemberAvatar } from "@/components/fletcher/member-avatar";

export interface MentionCandidate {
  id: string;
  name: string;
  role: MemberRole;
}

export interface MentionListHandle {
  /** Returns true when the key was consumed (arrows, Enter, Tab). */
  onKeyDown: (e: KeyboardEvent) => boolean;
}

/** Match on the start of the full name or of any word in it, so "ray" finds "Brad Ray". */
export function filterCandidates(members: MentionCandidate[], query: string, limit = 6): MentionCandidate[] {
  const q = query.toLowerCase();
  if (!q) return members.slice(0, limit);
  return members
    .filter((m) => {
      const name = m.name.toLowerCase();
      return name.startsWith(q) || (!q.includes(" ") && name.split(/\s+/).some((w) => w.startsWith(q)));
    })
    .slice(0, limit);
}

/** The @ suggestion list, shared by the comment box and the task doc editor. */
export function MentionList({ items, onPick, ref }: { items: MentionCandidate[]; onPick: (m: MentionCandidate) => void; ref?: Ref<MentionListHandle> }) {
  const [index, setIndex] = useState(0);
  // The list shrinks as the query narrows; clamp rather than reset so the highlight never points past the end.
  const active = Math.min(index, items.length - 1);

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (!items.length) return false;
      if (e.key === "ArrowDown") { setIndex((active + 1) % items.length); return true; }
      if (e.key === "ArrowUp") { setIndex((active - 1 + items.length) % items.length); return true; }
      if (e.key === "Enter" || e.key === "Tab") { onPick(items[active]!); return true; }
      return false;
    },
  }));

  if (!items.length) return null;
  return (
    <div role="listbox" aria-label="Mention someone" className="w-60 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-float">
      {items.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={i === active}
          // mousedown, not click: the text field must keep focus for the insertion to land.
          onMouseDown={(e) => { e.preventDefault(); onPick(m); }}
          onMouseEnter={() => setIndex(i)}
          className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", i === active && "bg-muted")}
        >
          <MemberAvatar name={m.name} size="xs" showTooltip={false} />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{m.name}</span>
          <span className="shrink-0 text-2xs text-muted-foreground">{MEMBER_ROLE_LABELS[m.role]}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Escape should close the suggestion list and nothing else. Radix sheets listen
 * for Escape on `document` in the capture phase, which runs before any handler
 * on the field itself — so the guard sits one level higher, on `window`.
 */
export function useEscapeGuard(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      onEscape();
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [active, onEscape]);
}
