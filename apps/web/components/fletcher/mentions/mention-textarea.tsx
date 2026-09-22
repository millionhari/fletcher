"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type Ref } from "react";
import type { MentionRef } from "@fletcher/core";
import { useMembers } from "@/lib/hooks/use-project-data";
import { Textarea } from "@/components/ui/textarea";
import { MentionList, filterCandidates, useEscapeGuard, type MentionCandidate, type MentionListHandle } from "./mention-list";

// "@" at the start or after whitespace/an opening bracket, then whatever has been typed since.
const TRIGGER = /(^|[\s(])@([^@\n]{0,30})$/;

/**
 * A textarea that suggests teammates after "@". The field holds readable text
 * (`@Brad Ray`); who was actually picked is reported through `onPickedChange`,
 * and the caller turns the two into stored tokens with `encodeMentions` on submit.
 */
export function MentionTextarea({ value, onValueChange, picked, onPickedChange, ref, onKeyDown, ...props }: Omit<ComponentProps<typeof Textarea>, "value" | "onChange" | "ref"> & { value: string; onValueChange: (v: string) => void; picked: MentionRef[]; onPickedChange: (p: MentionRef[]) => void; ref?: Ref<HTMLTextAreaElement> }) {
  const members = useMembers();
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const list = useRef<MentionListHandle>(null);
  const pendingCaret = useRef<number | null>(null);
  // Where the "@" sits and what follows it; null while no suggestion is open.
  const [trigger, setTrigger] = useState<{ at: number; query: string } | null>(null);

  const candidates = useMemo<MentionCandidate[]>(() => (members.data ?? []).map((m) => ({ id: m.id, name: m.name, role: m.role })), [members.data]);
  const items = trigger ? filterCandidates(candidates, trigger.query) : [];
  const open = items.length > 0;

  const sync = (el: HTMLTextAreaElement) => {
    const caret = el.selectionStart ?? 0;
    const m = TRIGGER.exec(el.value.slice(0, caret));
    setTrigger(m ? { at: caret - m[2]!.length - 1, query: m[2]! } : null);
  };

  const pick = (m: MentionCandidate) => {
    const el = inner.current;
    if (!el || !trigger) return;
    const caret = el.selectionStart ?? value.length;
    const inserted = `@${m.name} `;
    onValueChange(value.slice(0, trigger.at) + inserted + value.slice(caret));
    if (!picked.some((p) => p.memberId === m.id)) onPickedChange([...picked, { memberId: m.id, name: m.name }]);
    setTrigger(null);
    pendingCaret.current = trigger.at + inserted.length;
  };

  // Replacing the value drops the caret at the end; put it back right after the
  // inserted name, in the same commit — a deferred callback can fire after the
  // next keystroke and drag the caret backwards.
  useLayoutEffect(() => {
    const el = inner.current;
    if (pendingCaret.current == null || !el) return;
    el.focus();
    el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  const close = useCallback(() => setTrigger(null), []);
  useEscapeGuard(open, close);

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1">
          <MentionList ref={list} items={items} onPick={pick} />
        </div>
      )}
      <Textarea
        {...props}
        ref={(el) => {
          inner.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        value={value}
        onChange={(e) => { onValueChange(e.target.value); sync(e.target); }}
        onClick={(e) => sync(e.currentTarget)}
        onKeyUp={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") sync(e.currentTarget); }}
        onBlur={(e) => { close(); props.onBlur?.(e); }}
        onKeyDown={(e) => {
          if (open && list.current?.onKeyDown(e.nativeEvent)) { e.preventDefault(); return; }
          onKeyDown?.(e);
        }}
        aria-autocomplete="list"
      />
    </div>
  );
}
