import { z } from "zod";
import {
  DELIVERABLE_KINDS,
  MEMBER_ROLES,
  PLATFORMS,
  PROJECT_TYPES,
} from "./enums";

const weekday = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

export const timelineTaskDefSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  phase: z.string().min(1),
  roleKey: z.enum(MEMBER_ROLES),
  offsetDays: z.number().int(),
  durationDays: z.number().int().min(0).optional(),
  dependsOn: z.array(z.string()).optional(),
  snapTo: weekday.optional(),
  snapDirection: z.enum(["back", "forward"]).optional(),
  deliverable: z.object({ kind: z.enum(DELIVERABLE_KINDS), specKey: z.string().optional() }).optional(),
  milestone: z.object({ projectType: z.enum(PROJECT_TYPES), label: z.string() }).optional(),
  checklist: z.array(z.string().min(1)).optional(),
});

export const timelineTemplateDefSchema = z.object({
  anchorLabel: z.string().min(1),
  phases: z.array(z.object({ key: z.string().min(1), title: z.string().min(1) })),
  tasks: z.array(timelineTaskDefSchema),
  options: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        description: z.string().optional(),
        addTasks: z.array(timelineTaskDefSchema).optional(),
        overrideOffsets: z.record(z.string(), z.number().int()).optional(),
      }),
    )
    .optional(),
});

const commsItemDefSchema: z.ZodType<{ platform: (typeof PLATFORMS)[number]; title: string; children?: unknown[] }> =
  z.lazy(() =>
    z.object({
      platform: z.enum(PLATFORMS),
      title: z.string().min(1),
      children: z.array(commsItemDefSchema).optional(),
    }),
  );

export const commsTemplateDefSchema = z.object({
  checklists: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        items: z.array(commsItemDefSchema),
      }),
    )
    .optional(),
  moments: z.array(
    z.object({
      key: z.string().min(1),
      title: z.string().min(1),
      offsetDays: z.number().int(),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      cta: z.string().optional(),
      assetHint: z.string().optional(),
      items: z.array(commsItemDefSchema),
    }),
  ),
});

export const trackSchema = z.object({
  title: z.string().min(1),
  isrc: z.string().optional(),
  featuredArtists: z.array(z.string()).optional(),
  singleProjectId: z.string().optional(),
  isFocusTrack: z.boolean().optional(),
});

export const releaseInfoSchema = z.object({
  upc: z.string().optional(),
  isrc: z.string().optional(),
  appleTrackId: z.string().optional(),
  spotifyUri: z.string().optional(),
  retailLink: z.string().optional(),
  presaveLink: z.string().optional(),
  listeningLink: z.string().optional(),
  artworkFolderUrl: z.string().optional(),
  lyricsUrl: z.string().optional(),
  lyrics: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  featuredArtists: z.array(z.string()).optional(),
  releaseTime: z.string().optional(),
  releaseTimezone: z.string().optional(),
  distributor: z.string().optional(),
  label: z.string().optional(),
  pitchQuote: z.string().optional(),
  spotifyPitchBlurb: z.string().optional(),
  dspBio: z.string().optional(),
  tracklist: z.array(trackSchema).optional(),
});
export type ReleaseInfo = z.infer<typeof releaseInfoSchema>;
export type Track = z.infer<typeof trackSchema>;

/**
 * Where a comment is pinned inside a document or image. Rectangles are normalized
 * to the content box (0..1 on both axes), so a pin survives zooming, window
 * resizes and different device pixel ratios — the viewer multiplies by the
 * rendered size.
 */
const normalizedRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

/**
 * One freehand pen stroke. Points are normalized like rects; `width` is a
 * fraction of the content width so the line stays the same weight relative to
 * the picture at any zoom.
 */
const strokeSchema = z.object({
  points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(1),
  color: z.string().min(1),
  width: z.number().positive().max(0.1),
});

export const pdfCommentAnchorSchema = z.object({
  kind: z.literal("pdf"),
  page: z.number().int().min(1),
  rect: normalizedRectSchema,
  /** Present when the comment was drawn rather than boxed; `rect` is then the strokes' bounds. */
  strokes: z.array(strokeSchema).min(1).optional(),
});

/** Images are a single surface, so there is no page to carry. */
export const imageCommentAnchorSchema = z.object({
  kind: z.literal("image"),
  rect: normalizedRectSchema,
  strokes: z.array(strokeSchema).min(1).optional(),
});

export const commentAnchorSchema = z.discriminatedUnion("kind", [pdfCommentAnchorSchema, imageCommentAnchorSchema]);

export type NormalizedRect = z.infer<typeof normalizedRectSchema>;
export type Stroke = z.infer<typeof strokeSchema>;
export type PdfCommentAnchor = z.infer<typeof pdfCommentAnchorSchema>;
export type ImageCommentAnchor = z.infer<typeof imageCommentAnchorSchema>;
export type CommentAnchor = z.infer<typeof commentAnchorSchema>;

/** Page an anchor lives on; images always sit on the surface's single page. */
export function anchorPage(anchor: CommentAnchor): number {
  return anchor.kind === "pdf" ? anchor.page : 1;
}

/**
 * Stable per-comment highlight colour. Anchored boxes have to be told apart at a
 * glance and match their card in the sidebar, so the colour is derived from the
 * id rather than stored.
 */
export const ANCHOR_COLORS = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0d9488"] as const;

export function anchorColor(commentId: string): string {
  let h = 0;
  for (const ch of commentId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ANCHOR_COLORS[h % ANCHOR_COLORS.length]!;
}

/** A drawn comment keeps the pen colour the author picked; a boxed one gets the hashed colour. */
export function anchorDisplayColor(commentId: string, anchor: Pick<CommentAnchor, "strokes"> | null | undefined): string {
  return anchor?.strokes?.[0]?.color ?? anchorColor(commentId);
}

/** Pen colours offered in the viewer — a subset of the marker palette so drawings and boxes read as one family. */
export const PEN_COLORS = ["#dc2626", "#d97706", "#059669", "#2e6be6", "#7c3aed"] as const;

/** Smallest rect containing every stroke, padded a little so thick lines are not clipped at the edge. */
export function strokesBounds(strokes: Stroke[]): NormalizedRect {
  let x1 = 1, y1 = 1, x2 = 0, y2 = 0, pad = 0;
  for (const s of strokes) {
    pad = Math.max(pad, s.width);
    for (const [x, y] of s.points) {
      x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y);
    }
  }
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad); x2 = Math.min(1, x2 + pad); y2 = Math.min(1, y2 + pad);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}
