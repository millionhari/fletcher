"use client";

import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion";
import { MentionList, filterCandidates, type MentionCandidate, type MentionListHandle } from "./mention-list";

const DocMentionKey = new PluginKey("docMention");

type ListProps = { items: MentionCandidate[]; onPick: (m: MentionCandidate) => void };

/** Marks the `relative` wrapper around the editor that the suggestion popup mounts into. */
export const MENTION_HOST_ATTR = "data-mention-host";

/**
 * The extension is built once, but the member list loads later — so the owning
 * component hands it over through this object instead of a closure.
 */
export class DocMentionBridge {
  private members: MentionCandidate[] = [];
  setMembers = (members: MentionCandidate[]) => { this.members = members; };
  getMembers = () => this.members;
}

/**
 * @mentions for the task doc.
 *
 * The popup is mounted inside the editor's MENTION_HOST_ATTR wrapper rather
 * than on <body>: the task panel is a modal sheet, and anything outside it is
 * inert and counts as an outside click that would close it.
 */
export function createDocMention(bridge: DocMentionBridge) {
  const getMembers = bridge.getMembers;
  const hostOf = (props: SuggestionProps<MentionCandidate>) => props.editor.view.dom.closest<HTMLElement>(`[${MENTION_HOST_ATTR}]`);
  return Mention.configure({
    HTMLAttributes: { class: "mention" },
    renderText: ({ node }) => `@${node.attrs.label ?? ""}`,
    suggestion: {
      char: "@",
      pluginKey: DocMentionKey,
      items: ({ query }) => filterCandidates(getMembers(), query),
      render: () => {
        let renderer: ReactRenderer<MentionListHandle, ListProps> | null = null;
        let removeEscape: (() => void) | null = null;

        const listProps = (props: SuggestionProps<MentionCandidate>): ListProps => ({
          items: props.items,
          onPick: (m) => props.command({ id: m.id, label: m.name }),
        });
        const place = (props: SuggestionProps<MentionCandidate>) => {
          const container = hostOf(props);
          const rect = props.clientRect?.();
          if (!renderer || !container || !rect) return;
          const box = container.getBoundingClientRect();
          const el = renderer.element as HTMLElement;
          el.style.position = "absolute";
          el.style.zIndex = "50";
          // Follow the caret, but never hang off the right edge of the editor.
          el.style.left = `${Math.max(0, Math.min(rect.left - box.left, box.width - el.offsetWidth))}px`;
          el.style.top = `${rect.bottom - box.top + 4}px`;
        };

        return {
          onStart: (props) => {
            renderer = new ReactRenderer<MentionListHandle, ListProps>(MentionList, { props: listProps(props), editor: props.editor });
            hostOf(props)?.appendChild(renderer.element);
            place(props);
            // Escape closes only the list — see useEscapeGuard for why this sits on window/capture.
            const onEscape = (e: KeyboardEvent) => {
              if (e.key !== "Escape") return;
              e.stopPropagation();
              e.preventDefault();
              exitSuggestion(props.editor.view, DocMentionKey);
            };
            window.addEventListener("keydown", onEscape, true);
            removeEscape = () => window.removeEventListener("keydown", onEscape, true);
          },
          onUpdate: (props) => {
            renderer?.updateProps(listProps(props));
            place(props);
          },
          onKeyDown: ({ event }) => renderer?.ref?.onKeyDown(event) ?? false,
          onExit: () => {
            removeEscape?.();
            removeEscape = null;
            renderer?.element.remove();
            renderer?.destroy();
            renderer = null;
          },
        };
      },
    },
  });
}
