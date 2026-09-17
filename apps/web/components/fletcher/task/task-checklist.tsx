"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/fletcher/progress-ring";

export interface ChecklistItem {
  id: string;
  title: string;
  isDone: boolean;
  sortOrder: number;
}

export function TaskChecklist({ taskId, items, taskStatus, onChanged, onMarkTaskDone }: { taskId: string; items: ChecklistItem[]; taskStatus: string; onChanged: () => Promise<unknown>; onMarkTaskDone: () => void }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const add = useMutation(trpc.taskDetail.addChecklistItem.mutationOptions({ onSuccess: async () => { setDraft(""); await onChanged(); }, onError: (e) => toast.error(e.message) }));
  const update = useMutation(trpc.taskDetail.updateChecklistItem.mutationOptions({ onSuccess: onChanged, onError: (e) => toast.error(e.message) }));
  const remove = useMutation(trpc.taskDetail.removeChecklistItem.mutationOptions({ onSuccess: onChanged, onError: (e) => toast.error(e.message) }));
  const reorder = useMutation(trpc.taskDetail.reorderChecklist.mutationOptions({ onSuccess: onChanged, onError: (e) => toast.error(e.message) }));
  const done = items.filter((i) => i.isDone).length;
  const allDone = items.length > 0 && done === items.length;

  const dropOn = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(dragging);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragging);
    reorder.mutate({ workspace: ws.slug, taskId, itemIds: ids });
    setDragging(null);
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Checklist</span>
        {items.length > 0 && (<><ProgressBar value={(done / items.length) * 100} className="w-24" tone="success" /><span className="tabular text-2xs text-muted-foreground">{done}/{items.length}</span></>)}
        {allDone && taskStatus !== "done" && <Button variant="outline" size="xs" onClick={onMarkTaskDone}>Everything's checked — mark task done</Button>}
      </div>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li
            key={it.id}
            draggable
            onDragStart={() => setDragging(it.id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); dropOn(it.id); }}
            className={cn("group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50", dragging === it.id && "opacity-40")}
          >
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" />
            <Checkbox checked={it.isDone} onCheckedChange={(v) => update.mutate({ workspace: ws.slug, itemId: it.id, isDone: !!v })} />
            {editing === it.id ? (
              <Input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => { if (editValue.trim() && editValue !== it.title) update.mutate({ workspace: ws.slug, itemId: it.id, title: editValue.trim() }); setEditing(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(null); }}
                className="h-6 text-[13px]"
              />
            ) : (
              <button onClick={() => { setEditing(it.id); setEditValue(it.title); }} className={cn("min-w-0 flex-1 truncate text-left text-[13px]", it.isDone && "text-muted-foreground line-through")}>{it.title}</button>
            )}
            <Button variant="ghost" size="icon-xs" aria-label="Remove" className="opacity-0 group-hover:opacity-100" onClick={() => remove.mutate({ workspace: ws.slug, itemId: it.id })}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-center gap-2 px-1">
        <Plus className="size-3.5 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item… (Enter)"
          onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) add.mutate({ workspace: ws.slug, taskId, title: draft.trim() }); }}
          className="h-7 border-transparent bg-transparent px-1 text-[13px] shadow-none focus-visible:border-input"
        />
      </div>
    </div>
  );
}
