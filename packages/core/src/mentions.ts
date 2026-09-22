/**
 * Mentions are stored inside plain-text bodies as `@[Display Name](member-uuid)`.
 * The id is what counts — it survives renames and two people sharing a first
 * name — while the embedded name keeps the text readable anywhere the token
 * isn't rendered (exports, logs, a raw SQL peek).
 */
const TOKEN = /@\[([^\]\n]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export interface MentionRef {
  memberId: string;
  name: string;
}

export type MentionSegment = { type: "text"; text: string } | ({ type: "mention" } & MentionRef);

export function mentionToken(m: MentionRef): string {
  return `@[${m.name.replace(/[\[\]\n]/g, "")}](${m.memberId})`;
}

/** Split a stored body into text and mention runs, in order, for rendering. */
export function splitMentions(body: string): MentionSegment[] {
  const out: MentionSegment[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index > last) out.push({ type: "text", text: body.slice(last, m.index) });
    out.push({ type: "mention", name: m[1]!, memberId: m[2]!.toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ type: "text", text: body.slice(last) });
  return out;
}

/** Everyone mentioned in a stored body, once each. */
export function parseMentions(body: string): MentionRef[] {
  const seen = new Map<string, MentionRef>();
  for (const s of splitMentions(body)) if (s.type === "mention" && !seen.has(s.memberId)) seen.set(s.memberId, { memberId: s.memberId, name: s.name });
  return [...seen.values()];
}

/** The body as a person would read it: tokens collapsed to `@Name`. */
export function stripMentions(body: string): string {
  return body.replace(TOKEN, "@$1");
}

/**
 * Turn what was typed (`@Brad Ray`) into stored tokens. Only people actually
 * picked from the suggestion list count — typing a name by hand is not a
 * mention — and a pick whose text was since edited away is dropped. Longest
 * names go first so "@Sam Lee" isn't claimed by a pick of "@Sam".
 */
export function encodeMentions(text: string, picked: MentionRef[]): string {
  const byLength = [...picked].sort((a, b) => b.name.length - a.name.length);
  // Encoded runs are parked behind placeholders so a shorter name can't match inside one.
  const parked: string[] = [];
  let out = text;
  for (const m of byLength) {
    const needle = new RegExp(`@${escapeRegExp(m.name)}(?![\\w])`, "g");
    out = out.replace(needle, () => `\u0000${parked.push(mentionToken(m)) - 1}\u0000`);
  }
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => parked[Number(i)]!);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Member ids of every mention node in a Tiptap document (the task doc), once each. */
export function docMentionIds(doc: unknown): string[] {
  const ids = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: unknown; attrs?: { id?: unknown }; content?: unknown };
    if (n.type === "mention" && typeof n.attrs?.id === "string") ids.add(n.attrs.id);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return [...ids];
}
