"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { splitMentions } from "@fletcher/core";
import { useWorkspace } from "@/lib/hooks/use-workspace";

/** A stored body with its @mentions drawn as chips; a mention of the reader stands out. */
export function MentionText({ body, className }: { body: string; className?: string }) {
  const ws = useWorkspace();
  return (
    <span className={className}>
      {splitMentions(body).map((s, i) =>
        s.type === "text" ? (
          <Fragment key={i}>{s.text}</Fragment>
        ) : (
          <span key={i} className={cn("rounded px-0.5 font-medium", s.memberId === ws.memberId ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand")}>@{s.name}</span>
        ),
      )}
    </span>
  );
}
