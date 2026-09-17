import type { TimelineTemplateDef } from "../timeline/types";

/**
 * Album / EP release. Anchor = album release date.
 * Singles waterfall mirrors a typical 4-single campaign: S1 ~31 weeks out,
 * S2 ~15 weeks, S3 + album announce ~10 weeks, S4 ~4 weeks, focus track on release.
 */
export const ALBUM_RELEASE_TIMELINE: TimelineTemplateDef = {
  anchorLabel: "Album release date",
  phases: [
    { key: "planning", title: "Planning" },
    { key: "singles", title: "Singles waterfall" },
    { key: "music", title: "Music" },
    { key: "distribution", title: "Distribution" },
    { key: "announce", title: "Album announce" },
    { key: "creative", title: "Creative" },
    { key: "release", title: "Release" },
    { key: "post", title: "Post-release" },
  ],
  tasks: [
    { key: "goals", title: "Goal-setting meeting (management + team)", description: "Campaign goals, sonic lane, focus moments for DSPs to rally around.", phase: "planning", roleKey: "manager", offsetDays: -240 },
    { key: "single_choices", title: "Lock single choices + waterfall order", description: "Which 1–2 moments DSPs rally around; hidden tracklist or not; feature tagging.", phase: "planning", roleKey: "manager", offsetDays: -230 },
    { key: "content_shoot", title: "Campaign photo / content shoot", description: "Key art, press photos, DSP exclusives, banner source imagery.", phase: "planning", roleKey: "photographer", offsetDays: -224, durationDays: 1 },

    { key: "single_1", title: "Single 1 release", phase: "singles", roleKey: "manager", offsetDays: -217, snapTo: "fri", milestone: { projectType: "single", label: "Single 1" } },
    { key: "single_2", title: "Single 2 release", phase: "singles", roleKey: "manager", offsetDays: -105, snapTo: "fri", milestone: { projectType: "single", label: "Single 2" } },
    { key: "single_3", title: "Single 3 release + album announce", phase: "singles", roleKey: "manager", offsetDays: -70, snapTo: "fri", milestone: { projectType: "single", label: "Single 3" } },
    { key: "single_4", title: "Single 4 release + album presave push", phase: "singles", roleKey: "manager", offsetDays: -28, snapTo: "fri", milestone: { projectType: "single", label: "Single 4" } },

    { key: "all_masters", title: "All masters final", phase: "music", roleKey: "mastering_engineer", offsetDays: -49, durationDays: 14 },
    { key: "album_art", title: "Album artwork + packaging final", description: "Cover, back, layered sources, fonts; single art for remaining singles.", phase: "distribution", roleKey: "marketing", offsetDays: -49, durationDays: 21, deliverable: { kind: "image", specKey: "artwork_cover" } },
    { key: "album_metadata", title: "Album label copy, credits, lyrics, UPC + ISRCs", phase: "distribution", roleKey: "label_distributor", offsetDays: -42 },
    { key: "album_distro", title: "Full album to distributor", description: "All masters, artwork, metadata, lyrics.", phase: "distribution", roleKey: "label_distributor", offsetDays: -42, dependsOn: ["all_masters", "album_art", "album_metadata"] },

    { key: "listening_sessions", title: "DSP listening sessions", description: "Tastemaker session or individual DSP playbacks.", phase: "announce", roleKey: "marketing", offsetDays: -70 },
    { key: "album_presave", title: "Album presave / preorder + Spotify Countdown page live", phase: "announce", roleKey: "marketing", offsetDays: -70, snapTo: "fri" },
    { key: "album_announce", title: "Album announcement (artwork reveal, tracklist, date)", phase: "announce", roleKey: "social", offsetDays: -70, snapTo: "fri", dependsOn: ["album_presave"] },
    { key: "album_press_release", title: "Album press release", phase: "announce", roleKey: "publicist", offsetDays: -72, deliverable: { kind: "document" } },

    { key: "focus_video", title: "Focus track video final", phase: "creative", roleKey: "videographer", offsetDays: -7, durationDays: 28, deliverable: { kind: "video" } },
    { key: "all_canvases", title: "Spotify Canvas for every track", phase: "creative", roleKey: "videographer", offsetDays: -7, deliverable: { kind: "video", specKey: "dsp_spotify_canvas" } },
    { key: "visualizers", title: "Visualizers / art-track videos for every track without a video", phase: "creative", roleKey: "videographer", offsetDays: -7, deliverable: { kind: "video" } },
    { key: "album_trailer", title: "Album trailer", phase: "creative", roleKey: "videographer", offsetDays: -14, deliverable: { kind: "video" } },
    { key: "album_ads", title: "Album ad assets (:15 and :30, 4:5 and 9:16)", phase: "creative", roleKey: "videographer", offsetDays: -7, deliverable: { kind: "video", specKey: "ads_vertical_15" } },
    { key: "album_banners", title: "Album banners + Complete Collection playlist cover", phase: "creative", roleKey: "marketing", offsetDays: -7, deliverable: { kind: "image" } },
    { key: "story_videos", title: "Story-behind-the-song videos (≤ 30 s each)", phase: "creative", roleKey: "artist", offsetDays: -10, deliverable: { kind: "video" } },

    { key: "album_qc", title: "Release-night delivery QC (every track, every DSP)", phase: "release", roleKey: "marketing", offsetDays: 0 },
    { key: "album_release", title: "Album out now: posts, link flips, Countdown page → album, Artist Pick", phase: "release", roleKey: "social", offsetDays: 0, dependsOn: ["album_qc"] },

    { key: "album_report_fw", title: "Album First Week report", phase: "post", roleKey: "marketing", offsetDays: 7 },
    { key: "deluxe", title: "Deluxe edition (if planned)", phase: "post", roleKey: "manager", offsetDays: 21, snapTo: "fri" },
  ],
  options: [
    {
      key: "physical",
      label: "Physical formats (vinyl / CD)",
      description: "Vinyl needs 12–16 weeks of manufacturing lead time, so masters and art move up and merch tasks are added.",
      overrideOffsets: { all_masters: -119, album_art: -119, album_metadata: -112, album_distro: -112 },
      addTasks: [
        { key: "vinyl_variants", title: "Decide vinyl variants + quantities", description: "Standard, D2C exclusive, tour, indie retail, Spotify Fans First, Amazon, record clubs.", phase: "planning", roleKey: "merch", offsetDays: -140 },
        { key: "merch_projections", title: "Merch projections + PPD pricing from merch company", phase: "planning", roleKey: "merch", offsetDays: -133 },
        { key: "webstore_preorder", title: "Webstore preorder collection live", phase: "announce", roleKey: "merch", offsetDays: -70, snapTo: "fri" },
        { key: "luminate_title", title: "Luminate title registration", phase: "distribution", roleKey: "marketing", offsetDays: -35 },
      ],
    },
  ],
};

export const EP_RELEASE_TIMELINE: TimelineTemplateDef = {
  ...ALBUM_RELEASE_TIMELINE,
  anchorLabel: "EP release date",
  tasks: ALBUM_RELEASE_TIMELINE.tasks.filter((t) => t.key !== "single_4" && t.key !== "single_1").map((t) =>
    t.key === "single_2" ? { ...t, title: "Single 1 release", offsetDays: -84, milestone: { projectType: "single", label: "Single 1" } } :
    t.key === "single_3" ? { ...t, title: "Single 2 release + EP announce", offsetDays: -42, milestone: { projectType: "single", label: "Single 2" } } :
    t.key === "goals" ? { ...t, offsetDays: -120 } :
    t.key === "single_choices" ? { ...t, offsetDays: -112 } :
    t.key === "content_shoot" ? { ...t, offsetDays: -105 } :
    t.key === "listening_sessions" || t.key === "album_presave" || t.key === "album_announce" ? { ...t, offsetDays: -42 } :
    t.key === "album_press_release" ? { ...t, offsetDays: -44 } :
    t,
  ),
};
