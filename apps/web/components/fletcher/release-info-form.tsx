"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReleaseInfo, Track } from "@fletcher/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SheetFooter } from "@/components/ui/sheet";

type TextKey = Exclude<keyof ReleaseInfo, "tracklist" | "featuredArtists">;

export const RELEASE_INFO_FIELDS: { key: TextKey; label: string; placeholder?: string; mono?: boolean; wide?: boolean; multiline?: boolean; group: "ids" | "links" | "meta" | "copy" }[] = [
  { key: "upc", label: "UPC", mono: true, group: "ids" },
  { key: "isrc", label: "ISRC", mono: true, group: "ids" },
  { key: "appleTrackId", label: "Apple track ID", mono: true, group: "ids" },
  { key: "spotifyUri", label: "Spotify URI", mono: true, group: "ids" },
  { key: "presaveLink", label: "Presave link", group: "links" },
  { key: "retailLink", label: "Retail link", group: "links" },
  { key: "listeningLink", label: "Listening link", group: "links" },
  { key: "artworkFolderUrl", label: "Artwork folder", group: "links" },
  { key: "lyricsUrl", label: "Lyrics doc", group: "links" },
  { key: "genre", label: "Genre", group: "meta" },
  { key: "language", label: "Language", group: "meta" },
  { key: "label", label: "Label", group: "meta" },
  { key: "distributor", label: "Distributor", group: "meta" },
  { key: "releaseTime", label: "Release time", placeholder: "00:00", group: "meta" },
  { key: "releaseTimezone", label: "Timezone", placeholder: "America/Chicago", group: "meta" },
  { key: "pitchQuote", label: "Pitch quote", multiline: true, wide: true, group: "copy" },
  { key: "spotifyPitchBlurb", label: "Spotify pitch blurb (back end)", multiline: true, wide: true, group: "copy" },
  { key: "dspBio", label: "Shortened DSP bio", multiline: true, wide: true, group: "copy" },
  { key: "lyrics", label: "Lyrics", multiline: true, wide: true, group: "copy" },
];

const GROUP_TITLES = { ids: "Identifiers", links: "Links", meta: "Metadata", copy: "Copy" } as const;

// Artists are typed as one comma-separated field; keeping the raw text in the
// draft (instead of the parsed array) lets a trailing ", " survive a keystroke.
type TrackDraft = Omit<Track, "featuredArtists"> & { id: number; featured: string };

function splitArtists(text: string): string[] | undefined {
  const names = text.split(",").map((n) => n.trim()).filter(Boolean);
  return names.length ? names : undefined;
}

function blankToUndefined(v: string | undefined): string | undefined {
  return v && v.trim() !== "" ? v.trim() : undefined;
}

/** Body + footer of the release info sheet. Mounted per open, so the draft always starts from the saved info. */
export function ReleaseInfoForm({ info, showTracklist, saving, onCancel, onSave }: { info: ReleaseInfo; showTracklist: boolean; saving: boolean; onCancel: () => void; onSave: (info: ReleaseInfo) => void }) {
  const [text, setText] = useState<Partial<Record<TextKey, string>>>(() => Object.fromEntries(RELEASE_INFO_FIELDS.map((f) => [f.key, info[f.key] ?? ""])));
  const [featured, setFeatured] = useState((info.featuredArtists ?? []).join(", "));
  const [tracks, setTracks] = useState<TrackDraft[]>(() => (info.tracklist ?? []).map(({ featuredArtists, ...t }, i) => ({ ...t, id: i, featured: (featuredArtists ?? []).join(", ") })));
  const [nextId, setNextId] = useState(tracks.length);

  const setTrack = (id: number, patch: Partial<TrackDraft>) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const addTrack = () => { setTracks((prev) => [...prev, { id: nextId, title: "", featured: "" }]); setNextId(nextId + 1); };
  const moveTrack = (i: number, dir: -1 | 1) => setTracks((prev) => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  });
  // A release has one focus track, so starring a track un-stars the rest.
  const toggleFocus = (id: number) => setTracks((prev) => prev.map((t) => ({ ...t, isFocusTrack: t.id === id ? !t.isFocusTrack : false })));

  const submit = () => {
    const tracklist = tracks
      .filter((t) => t.title.trim())
      .map((t): Track => ({ title: t.title.trim(), isrc: blankToUndefined(t.isrc), featuredArtists: splitArtists(t.featured), singleProjectId: t.singleProjectId, isFocusTrack: t.isFocusTrack || undefined }));
    onSave({
      ...info,
      ...Object.fromEntries(RELEASE_INFO_FIELDS.map((f) => [f.key, blankToUndefined(text[f.key])])),
      featuredArtists: splitArtists(featured),
      tracklist: tracklist.length ? tracklist : undefined,
    });
  };

  return (
    <>
      <div className="grid gap-6 px-4 pb-4">
        {(["ids", "links", "meta"] as const).map((g) => (
          <FieldGroup key={g} title={GROUP_TITLES[g]}>
            {RELEASE_INFO_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key} className="grid gap-1">
                <Label htmlFor={`ri-${f.key}`} className="text-xs">{f.label}</Label>
                <Input id={`ri-${f.key}`} placeholder={f.placeholder} className={f.mono ? "font-mono" : undefined} value={text[f.key] ?? ""} onChange={(e) => setText({ ...text, [f.key]: e.target.value })} />
              </div>
            ))}
            {g === "meta" && (
              <div className="col-span-2 grid gap-1">
                <Label htmlFor="ri-featured" className="text-xs">Featured artists</Label>
                <Input id="ri-featured" placeholder="Separate names with commas" value={featured} onChange={(e) => setFeatured(e.target.value)} />
              </div>
            )}
          </FieldGroup>
        ))}

        {showTracklist && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Tracklist{tracks.length > 0 && <span className="tabular ml-1.5 font-normal">{tracks.length}</span>}</div>
              <Button variant="ghost" size="xs" onClick={addTrack}><Plus />Track</Button>
            </div>
            {tracks.length === 0 ? (
              <button type="button" onClick={addTrack} className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">No tracks yet. Add the first one.</button>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {tracks.map((t, i) => (
                  <div key={t.id} className="flex items-start gap-2 p-2">
                    <span className="tabular mt-2 w-5 shrink-0 text-right text-2xs text-muted-foreground">{i + 1}</span>
                    <div className="grid min-w-0 flex-1 grid-cols-[1fr_140px] gap-1.5">
                      <Input aria-label={`Track ${i + 1} title`} placeholder="Track title" autoFocus={!t.title && i === tracks.length - 1} value={t.title} onChange={(e) => setTrack(t.id, { title: e.target.value })} className="h-8 text-[13px]" />
                      <Input aria-label={`Track ${i + 1} ISRC`} placeholder="ISRC" value={t.isrc ?? ""} onChange={(e) => setTrack(t.id, { isrc: e.target.value })} className="h-8 font-mono text-xs" />
                      <Input aria-label={`Track ${i + 1} featured artists`} placeholder="Featured artists (comma-separated)" value={t.featured} onChange={(e) => setTrack(t.id, { featured: e.target.value })} className="col-span-2 h-7 text-xs" />
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 pt-1">
                      <Button variant="ghost" size="icon-xs" aria-label={t.isFocusTrack ? "Unmark focus track" : "Mark as focus track"} aria-pressed={!!t.isFocusTrack} title="Focus track" onClick={() => toggleFocus(t.id)} className={cn(t.isFocusTrack ? "text-brand" : "text-muted-foreground/60")}><Star className={cn(t.isFocusTrack && "fill-current")} /></Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={i === 0} onClick={() => moveTrack(i, -1)}><ChevronUp /></Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Move down" disabled={i === tracks.length - 1} onClick={() => moveTrack(i, 1)}><ChevronDown /></Button>
                      <Button variant="ghost" size="icon-xs" aria-label={`Remove ${t.title || "track"}`} onClick={() => setTracks((prev) => prev.filter((x) => x.id !== t.id))} className="text-muted-foreground hover:text-danger"><Trash2 /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <FieldGroup title={GROUP_TITLES.copy}>
          {RELEASE_INFO_FIELDS.filter((f) => f.group === "copy").map((f) => (
            <div key={f.key} className="col-span-2 grid gap-1">
              <Label htmlFor={`ri-${f.key}`} className="text-xs">{f.label}</Label>
              <Textarea id={`ri-${f.key}`} rows={f.key === "lyrics" ? 8 : 4} value={text[f.key] ?? ""} onChange={(e) => setText({ ...text, [f.key]: e.target.value })} />
            </div>
          ))}
        </FieldGroup>
      </div>
      <SheetFooter className="sticky bottom-0 flex-row justify-end border-t border-border bg-background">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save"}</Button>
      </SheetFooter>
    </>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
