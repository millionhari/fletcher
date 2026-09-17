import type { ProjectType, TemplateKind } from "../enums";
import type { TimelineTemplateDef } from "../timeline/types";
import type { CommsTemplateDef } from "../comms/types";
import { SINGLE_RELEASE_TIMELINE } from "./single-release";
import { ALBUM_RELEASE_TIMELINE, EP_RELEASE_TIMELINE } from "./album-release";
import { MUSIC_VIDEO_TIMELINE } from "./music-video";
import { TOUR_ANNOUNCE_TIMELINE } from "./tour-announce";
import { SINGLE_RELEASE_COMMS } from "./comms-single";
import { ALBUM_ANNOUNCE_COMMS } from "./comms-album";

export interface SystemTemplate {
  key: string;
  kind: TemplateKind;
  projectType: ProjectType;
  name: string;
  description: string;
  definition: TimelineTemplateDef | CommsTemplateDef;
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  { key: "single_timeline", kind: "timeline", projectType: "single", name: "Single release", description: "Production → mix → master → distro (6 wks) → pitch (3 wks) → announce (Mon, 11 days out) → release → reports.", definition: SINGLE_RELEASE_TIMELINE },
  { key: "album_timeline", kind: "timeline", projectType: "album", name: "Album release", description: "Four-single waterfall, album announce 10 weeks out, masters to distro 6 weeks out (16 with vinyl).", definition: ALBUM_RELEASE_TIMELINE },
  { key: "ep_timeline", kind: "timeline", projectType: "ep", name: "EP release", description: "Two-single waterfall with EP announce 6 weeks out.", definition: EP_RELEASE_TIMELINE },
  { key: "music_video_timeline", kind: "timeline", projectType: "music_video", name: "Music video", description: "Treatment → shoot → rough cut → review rounds → final → premiere.", definition: MUSIC_VIDEO_TIMELINE },
  { key: "tour_timeline", kind: "timeline", projectType: "tour", name: "Tour announce", description: "Two weeks of prep, announce, staggered presales, Friday on-sale.", definition: TOUR_ANNOUNCE_TIMELINE },
  { key: "single_comms", kind: "comms", projectType: "single", name: "Single release comms", description: "CRM teaser, artwork reveal + presave, teaser 2, reminder, release night, release day, premiere, promo.", definition: SINGLE_RELEASE_COMMS },
  { key: "album_comms", kind: "comms", projectType: "album", name: "Album announce comms", description: "Cryptic teaser, watch page + profile swaps, single out now, premiere + album announcement, promo.", definition: ALBUM_ANNOUNCE_COMMS },
  { key: "ep_comms", kind: "comms", projectType: "ep", name: "EP announce comms", description: "Same shape as the album announce plan.", definition: ALBUM_ANNOUNCE_COMMS },
];

export { SINGLE_RELEASE_TIMELINE, ALBUM_RELEASE_TIMELINE, EP_RELEASE_TIMELINE, MUSIC_VIDEO_TIMELINE, TOUR_ANNOUNCE_TIMELINE, SINGLE_RELEASE_COMMS, ALBUM_ANNOUNCE_COMMS };
