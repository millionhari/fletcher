"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Bold, Heading2, Italic, Link2, List, ListChecks, ListOrdered, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMembers } from "@/lib/hooks/use-project-data";
import { DocMentionBridge, MENTION_HOST_ATTR, createDocMention } from "@/components/fletcher/mentions/doc-mention";

export interface DocSave {
  doc: unknown;
  docText: string;
}

/**
 * Task doc. Renders the saved content read-only; Edit opens the Tiptap editor,
 * Save (or ⌘S) writes it and returns to the read view, Cancel discards changes.
 */
export function TaskDocEditor({ initialDoc, seedText, onSave, saving, savedAt }: { initialDoc: unknown | null; seedText?: string | null; onSave: (s: DocSave) => void; saving: boolean; savedAt: Date | null }) {
  const [editing, setEditing] = useState(false);
  const snapshot = useRef<JSONContent | null>(null);
  const hasDoc = !!initialDoc;
  const members = useMembers();
  const [mentionBridge] = useState(() => new DocMentionBridge());
  useEffect(() => {
    mentionBridge.setMembers((members.data ?? []).map((m) => ({ id: m.id, name: m.name, role: m.role })));
  }, [mentionBridge, members.data]);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Brief, notes, links, decisions… @ to mention someone" }),
      Link.configure({ openOnClick: true, autolink: true, defaultProtocol: "https" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      createDocMention(mentionBridge),
    ],
    content: (initialDoc as JSONContent | null) ?? (seedText ? `<p>${escapeHtml(seedText)}</p>` : ""),
    editorProps: { attributes: { class: "prose-fletcher min-h-[120px] px-1 py-1" } },
  });

  const startEditing = () => {
    if (!editor) return;
    snapshot.current = editor.getJSON();
    editor.setEditable(true);
    setEditing(true);
    requestAnimationFrame(() => editor.commands.focus("end"));
  };
  const save = () => {
    if (!editor) return;
    onSave({ doc: editor.getJSON(), docText: editor.getText() });
    editor.setEditable(false);
    setEditing(false);
  };
  const cancel = () => {
    if (!editor) return;
    if (snapshot.current) editor.commands.setContent(snapshot.current);
    editor.setEditable(false);
    setEditing(false);
  };

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
      if (e.key === "Escape" && editor?.isFocused) cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!editor) return <div className="min-h-[120px] rounded-lg border border-border" />;
  const isEmpty = editor.isEmpty;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className={cn("group/doc rounded-lg transition-colors", editing ? "border border-border bg-card focus-within:border-ring/60" : "-mx-3 border border-transparent px-3")}>
      {editing ? (
        <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
          <Tool active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold"><Bold /></Tool>
          <Tool active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic"><Italic /></Tool>
          <Tool active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading"><Heading2 /></Tool>
          <Tool active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullets"><List /></Tool>
          <Tool active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered"><ListOrdered /></Tool>
          <Tool active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} label="Checklist"><ListChecks /></Tool>
          <Tool active={editor.isActive("link")} onClick={setLink} label="Link"><Link2 /></Tool>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="xs" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>Cancel</Button>
            <Button size="xs" disabled={saving} onMouseDown={(e) => e.preventDefault()} onClick={save}>{saving ? "Saving…" : "Save"} <span className="ml-1 font-mono text-[10px] opacity-60">⌘S</span></Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Brief</span>
          <div className="flex items-center gap-2">
            {savedAt && hasDoc && <span className="text-2xs text-muted-foreground">Edited {timeAgo(savedAt)}</span>}
            <Button variant="outline" size="xs" onClick={startEditing}><Pencil />Edit</Button>
          </div>
        </div>
      )}
      <div {...{ [MENTION_HOST_ATTR]: "" }} className={cn("relative", editing ? "px-3 py-2" : "pb-2")}>
        {!editing && isEmpty ? (
          <p className="py-4 text-[13px] text-muted-foreground">No brief yet. Use Edit to write one: what needs to happen, links, decisions.</p>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}

function Tool({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon-xs" aria-label={label} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={cn(active && "bg-muted text-foreground")}>
      {children}
    </Button>
  );
}

function timeAgo(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
