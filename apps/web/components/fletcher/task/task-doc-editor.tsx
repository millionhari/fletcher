"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Bold, Heading2, Italic, Link2, List, ListChecks, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DocSave {
  doc: unknown;
  docText: string;
}

/** Rich-text task doc. Autosaves 800ms after the last change; Cmd+S saves immediately. */
export function TaskDocEditor({ initialDoc, seedText, onSave, saving, savedAt }: { initialDoc: unknown | null; seedText?: string | null; onSave: (s: DocSave) => void; saving: boolean; savedAt: Date | null }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Brief, notes, links, decisions…" }),
      Link.configure({ openOnClick: true, autolink: true, defaultProtocol: "https" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: (initialDoc as object | null) ?? (seedText ? `<p>${escapeHtml(seedText)}</p>` : ""),
    editorProps: { attributes: { class: "prose-fletcher min-h-[160px] px-1 py-1" } },
    onUpdate: ({ editor }) => {
      setDirty(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onSave({ doc: editor.getJSON(), docText: editor.getText() });
        setDirty(false);
      }, 800);
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && editor?.isFocused) {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        onSave({ doc: editor.getJSON(), docText: editor.getText() });
        setDirty(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, onSave]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!editor) return <div className="min-h-[160px] rounded-lg border border-border" />;
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="rounded-lg border border-border bg-card focus-within:border-ring/60">
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
        <Tool active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold"><Bold /></Tool>
        <Tool active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic"><Italic /></Tool>
        <Tool active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading"><Heading2 /></Tool>
        <Tool active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullets"><List /></Tool>
        <Tool active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered"><ListOrdered /></Tool>
        <Tool active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} label="Checklist"><ListChecks /></Tool>
        <Tool active={editor.isActive("link")} onClick={setLink} label="Link"><Link2 /></Tool>
        <span className="ml-auto pr-1 text-2xs text-muted-foreground">{saving ? "Saving…" : dirty ? "Unsaved" : savedAt ? `Saved ${timeAgo(savedAt)}` : ""}</span>
      </div>
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
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
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
