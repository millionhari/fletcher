import type { TimelineTemplateDef } from "../timeline/types";

/** Tour announce → on-sale week. Anchor = announce date (usually a Monday). */
export const TOUR_ANNOUNCE_TIMELINE: TimelineTemplateDef = {
  anchorLabel: "Announce date",
  phases: [
    { key: "prep", title: "Preparation" },
    { key: "announce", title: "Announce" },
    { key: "presale", title: "Presales" },
    { key: "onsale", title: "On-sale" },
    { key: "post", title: "Post on-sale" },
  ],
  tasks: [
    { key: "seated", title: "Send Seated the dates; ask about off-platform presale", phase: "prep", roleKey: "marketing", offsetDays: -14 },
    { key: "vip", title: "Send VIP company the dates to start advancing", phase: "prep", roleKey: "manager", offsetDays: -14 },
    { key: "venue_memos", title: "Marketing memos to venues", phase: "prep", roleKey: "booking_agent", offsetDays: -14 },
    { key: "admat", title: "Admat, ticketing photo, ticketing bio", phase: "prep", roleKey: "marketing", offsetDays: -7, deliverable: { kind: "image" } },
    { key: "ad_copy", title: "Approved ad copy (announce / on-sale / low tickets)", phase: "prep", roleKey: "marketing", offsetDays: -7 },
    { key: "announce", title: "Tour announce + Seated presale sign-ups", phase: "announce", roleKey: "social", offsetDays: 0, dependsOn: ["admat"] },
    { key: "listings", title: "Dates live on Bandsintown, Songkick, Seated; all ticket links checked", phase: "announce", roleKey: "marketing", offsetDays: 0 },
    { key: "artist_presale", title: "Artist presale", phase: "presale", roleKey: "marketing", offsetDays: 1 },
    { key: "spotify_presale", title: "Spotify presale", phase: "presale", roleKey: "marketing", offsetDays: 2 },
    { key: "venue_presale", title: "Venue / promoter presale", phase: "presale", roleKey: "booking_agent", offsetDays: 3 },
    { key: "presales_end", title: "All presales end; export Seated + Bandsintown emails", phase: "presale", roleKey: "marketing", offsetDays: 3 },
    { key: "onsale", title: "General on-sale", phase: "onsale", roleKey: "social", offsetDays: 4, snapTo: "fri" },
    { key: "onsale_check", title: "Check every ticket link at local on-sale time per timezone", phase: "onsale", roleKey: "marketing", offsetDays: 4, snapTo: "fri" },
    { key: "reminder", title: "On-sale reminder push", phase: "post", roleKey: "social", offsetDays: 11 },
  ],
};
