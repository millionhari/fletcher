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
