import type { TimelineTemplateDef } from "../timeline/types";

/** Music video production. Anchor = premiere date. */
export const MUSIC_VIDEO_TIMELINE: TimelineTemplateDef = {
  anchorLabel: "Premiere date",
  phases: [
    { key: "pre", title: "Pre-production" },
    { key: "shoot", title: "Shoot" },
    { key: "post", title: "Post-production" },
    { key: "delivery", title: "Delivery" },
    { key: "premiere", title: "Premiere" },
  ],
  tasks: [
    { key: "treatment", title: "Treatment / concept approved", phase: "pre", roleKey: "videographer", offsetDays: -35, durationDays: 7, deliverable: { kind: "document" } },
    { key: "preprod", title: "Pre-production locked (locations, crew, wardrobe, budget)", phase: "pre", roleKey: "videographer", offsetDays: -28, durationDays: 7, dependsOn: ["treatment"], checklist: ["Locations locked", "Crew confirmed", "Wardrobe + glam booked", "Shot list approved", "Budget signed off"] },
    { key: "shoot", title: "Shoot day", phase: "shoot", roleKey: "videographer", offsetDays: -21, durationDays: 1, dependsOn: ["preprod"] },
    { key: "bts", title: "BTS + vertical clips captured", description: "Studio / set footage, handwritten lyrics, behind-the-song. Vertical for socials, horizontal for B-roll.", phase: "shoot", roleKey: "social", offsetDays: -21, deliverable: { kind: "video" } },
    { key: "rough_cut", title: "Rough cut (v1) delivered", phase: "post", roleKey: "videographer", offsetDays: -14, durationDays: 7, dependsOn: ["shoot"], deliverable: { kind: "video" } },
    { key: "notes_1", title: "Review round 1 notes", phase: "post", roleKey: "artist", offsetDays: -12, dependsOn: ["rough_cut"] },
    { key: "fine_cut", title: "Fine cut (v2) delivered", phase: "post", roleKey: "videographer", offsetDays: -9, durationDays: 3, dependsOn: ["notes_1"], deliverable: { kind: "video" } },
    { key: "notes_2", title: "Review round 2 notes", phase: "post", roleKey: "artist", offsetDays: -8, dependsOn: ["fine_cut"] },
    { key: "final_master", title: "Color, sound and final master approved", phase: "post", roleKey: "videographer", offsetDays: -5, durationDays: 3, dependsOn: ["notes_2"], deliverable: { kind: "video" } },
    { key: "thumbnail", title: "Thumbnail", phase: "delivery", roleKey: "videographer", offsetDays: -5, deliverable: { kind: "image", specKey: "video_thumbnail" } },
    { key: "cutdowns", title: "Vertical cutdowns + teasers", phase: "delivery", roleKey: "videographer", offsetDays: -4, dependsOn: ["final_master"], deliverable: { kind: "video" } },
    { key: "yt_schedule", title: "YouTube premiere scheduled + countdown asset delivered", description: "Countdown video (2 min suggested, 5 max) and the watch-page link to YouTube at least 48 h before.", phase: "delivery", roleKey: "marketing", offsetDays: -2, dependsOn: ["final_master", "thumbnail"], checklist: ["Countdown asset delivered (2 min)", "Watch-page link created", "Thumbnail uploaded", "Description, tags and end screen set", "Premiere time confirmed with team"] },
    { key: "premiere", title: "Premiere", phase: "premiere", roleKey: "social", offsetDays: 0 },
    { key: "yt_optimize", title: "Add to #1 on video playlist, featured on home, end screen, Shorts cutdown", phase: "premiere", roleKey: "marketing", offsetDays: 0 },
    { key: "website", title: "Add video to website", phase: "premiere", roleKey: "web", offsetDays: 1 },
  ],
};
