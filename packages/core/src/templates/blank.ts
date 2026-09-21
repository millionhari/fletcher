import type { ProjectType } from "../enums";
import type { TimelineTemplateDef } from "../timeline/types";
import type { CommsTemplateDef } from "../comms/types";

/**
 * Anchor labels for a from-scratch timeline. The anchor is the one date the
 * user picks on the wizard; every task offset is measured from it, so the label
 * has to read correctly for the project type ("Release date", "Shoot date", …).
 */
export const DEFAULT_ANCHOR_LABELS: Record<ProjectType, string> = {
  single: "Release date",
  album: "Release date",
  ep: "Release date",
  music_video: "Premiere date",
  tour: "Announce date",
  campaign: "Campaign date",
  custom: "Anchor date",
};

/**
 * Starting point for a template built from scratch. Three generic phases so the
 * editor has somewhere to put the first task — they are renamable and removable.
 */
export function blankTimelineTemplateDef(projectType: ProjectType): TimelineTemplateDef {
  return {
    anchorLabel: DEFAULT_ANCHOR_LABELS[projectType],
    phases: [
      { key: "prep", title: "Prep" },
      { key: "launch", title: "Launch" },
      { key: "post", title: "Post" },
    ],
    tasks: [],
  };
}

export function blankCommsTemplateDef(): CommsTemplateDef {
  return { moments: [] };
}
