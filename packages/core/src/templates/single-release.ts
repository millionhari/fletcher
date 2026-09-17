import type { TimelineTemplateDef } from "../timeline/types";

/**
 * Single release timeline. Anchor = release date (a Friday).
 * Offsets encode the industry defaults from the marketing playbook:
 * distro needs masters 6 weeks out, mastering takes ~48h, mixing ~10 days,
 * production ~1 week per song, editorial pitching 3 weeks out, announce the
 * Monday ~11 days before release.
 */
export const SINGLE_RELEASE_TIMELINE: TimelineTemplateDef = {
  anchorLabel: "Release date",
  phases: [
    { key: "music", title: "Music" },
    { key: "distribution", title: "Distribution" },
    { key: "pitching", title: "Pitching" },
    { key: "creative", title: "Creative" },
    { key: "profiles", title: "Profiles & assets" },
    { key: "announce", title: "Announce" },
    { key: "release", title: "Release" },
    { key: "post", title: "Post-release" },
  ],
  tasks: [
    // Music
    { key: "production", title: "Production complete", description: "Producer delivers the produced track ready for mix.", phase: "music", roleKey: "producer", offsetDays: -56, durationDays: 7 },
    { key: "mix", title: "Mix delivered", description: "Final mix approved by artist and management.", phase: "music", roleKey: "mix_engineer", offsetDays: -46, durationDays: 10, dependsOn: ["production"] },
    { key: "master", title: "Master delivered", description: "Mastered WAV (and Dolby Atmos if planned).", phase: "music", roleKey: "mastering_engineer", offsetDays: -44, durationDays: 2, dependsOn: ["mix"] },

    // Distribution
    { key: "dsp_access", title: "Confirm DSP back-end access + digital audit", description: "Spotify for Artists, Apple Music for Artists, Amazon, Pandora AMP, YouTube. Note duplicate profiles or unclaimed pages.", phase: "distribution", roleKey: "marketing", offsetDays: -56, checklist: ["Spotify for Artists access", "Apple Music for Artists access", "Amazon Music for Artists access", "Pandora AMP claimed", "YouTube Studio / Official Artist Channel", "Meta Business Manager + pixel", "Website, mailing list and tag manager access", "Note duplicate or unclaimed DSP profiles"] },
    { key: "artwork", title: "Single artwork final", description: "3000×3000 cover plus the layered 300dpi source, transparent logo and font files.", phase: "distribution", roleKey: "marketing", offsetDays: -42, durationDays: 14, deliverable: { kind: "image", specKey: "artwork_cover" } },
    { key: "label_copy", title: "Label copy, metadata, lyrics, UPC + ISRC", description: "Songwriters, splits, publishing, lyrics, featured-artist tagging (primary vs featured), genre, language.", phase: "distribution", roleKey: "label_distributor", offsetDays: -42, checklist: ["Songwriters and splits", "Publishers and PROs", "ISRC", "UPC", "Featured artists tagged primary vs featured", "Explicit flag and language"] },
    { key: "distro_delivery", title: "Deliver to distributor", description: "Master, artwork, metadata and lyrics delivered. Decide store-turn vs globally timed release.", phase: "distribution", roleKey: "label_distributor", offsetDays: -42, dependsOn: ["master", "artwork", "label_copy"], checklist: ["Master WAV (and Atmos if planned)", "Artwork 3000×3000 RGB", "Label copy and credits", "Lyrics", "Store-turn vs globally timed release decided", "Genre and language set"] },
    { key: "dsp_qc", title: "Confirm delivery + profile mapping on DSPs", description: "Track shows on the correct artist profile on every DSP; artwork is not the placeholder.", phase: "distribution", roleKey: "marketing", offsetDays: -21, dependsOn: ["distro_delivery"] },

    // Pitching
    { key: "warmup", title: "Discovery Mode opt-in + Showcase warm-up", description: "Opt eligible catalog into Discovery Mode and run a Showcase on a catalog track to reactivate listeners.", phase: "pitching", roleKey: "marketing", offsetDays: -28 },
    { key: "pitch_spotify", title: "Spotify editorial pitch", description: "Submit in Spotify for Artists at least 7 days before release to be eligible for Release Radar.", phase: "pitching", roleKey: "marketing", offsetDays: -21, dependsOn: ["distro_delivery"], checklist: ["Pitch copy under 500 characters", "Genre, mood and instrumentation tags", "Similar artists", "Submitted at least 7 days before release"] },
    { key: "pitch_others", title: "Apple / Amazon / Pandora pitches", description: "Pitch via label or distributor reps. Include the shortened DSP bio and pitch quote.", phase: "pitching", roleKey: "marketing", offsetDays: -21, dependsOn: ["distro_delivery"] },

    // Creative
    { key: "video_final", title: "Official video / lyric video / visualizer final", description: "Hi-res file approved. Every track needs at least an art-track or visualizer.", phase: "creative", roleKey: "videographer", offsetDays: -14, durationDays: 21, deliverable: { kind: "video" } },
    { key: "teaser_1", title: "Teaser 1", phase: "creative", roleKey: "social", offsetDays: -11, deliverable: { kind: "video" } },
    { key: "teaser_2", title: "Teaser 2", phase: "creative", roleKey: "social", offsetDays: -7, deliverable: { kind: "video" } },
    { key: "teaser_3", title: "Teaser 3", phase: "creative", roleKey: "social", offsetDays: -3, deliverable: { kind: "video" } },
    { key: "canvas", title: "Spotify Canvas + Clips", description: "Canvas: 9:16 loop, 3–8 s. Clips: vertical, under 30 s.", phase: "creative", roleKey: "videographer", offsetDays: -5, deliverable: { kind: "video", specKey: "dsp_spotify_canvas" } },
    { key: "ad_cutdowns", title: "Ad cutdowns :15 vertical + :30 square", phase: "creative", roleKey: "videographer", offsetDays: -7, dependsOn: ["video_final"], deliverable: { kind: "video", specKey: "ads_vertical_15" } },
    { key: "art_track", title: "Static art-track video for YouTube", phase: "creative", roleKey: "videographer", offsetDays: -7, deliverable: { kind: "video" } },

    // Profiles & assets
    { key: "dsp_photos", title: "DSP exclusive photos delivered", description: "4–5 tight close-ups, at least one horizontal, no logos or filters.", phase: "profiles", roleKey: "photographer", offsetDays: -21, deliverable: { kind: "image", specKey: "dsp_exclusive_photos" } },
    { key: "dsp_bio", title: "Shortened DSP bio", phase: "profiles", roleKey: "publicist", offsetDays: -21, deliverable: { kind: "document" } },
    { key: "liners", title: "Liners recorded (Pandora, Spotify, Amazon, Apple)", description: "Audio under 15 s for Pandora AMP; vertical video for Spotify and Apple; Alexa liner for Amazon.", phase: "profiles", roleKey: "artist", offsetDays: -14, deliverable: { kind: "audio" }, checklist: ["Pandora: pre-play liner", "Pandora: post-play liner", "Pandora: tap-to-hear liner", "Spotify: vertical video liner", "Amazon: Alexa follow liner", "Apple Music: audio + vertical liner"] },
    { key: "banners_pre", title: "Pre-release banners + profile refresh", description: "All social and DSP headers with the presave CTA; profile images swapped to the campaign photo.", phase: "profiles", roleKey: "marketing", offsetDays: -11, durationDays: 5, deliverable: { kind: "image" }, checklist: ["Facebook cover", "X header", "YouTube banner", "Spotify header", "Amazon background", "Apple Music background", "Email header", "Link-in-bio header"] },
    { key: "banners_release", title: "Release banners (out now)", phase: "profiles", roleKey: "marketing", offsetDays: -1, deliverable: { kind: "image" } },

    // Announce
    { key: "presave_link", title: "Presave / multi-retailer link built", description: "All DSPs present. Override Spotify to an artist-owned playlist. Email opt-in enabled with privacy language.", phase: "announce", roleKey: "marketing", offsetDays: -12, checklist: ["Every DSP on the link", "Spotify points to an artist-owned playlist", "Email opt-in on with privacy language", "Region variants if needed", "Short link tested on mobile"] },
    { key: "announce", title: "Announcement + presave launch", description: "For a Friday release this is the Monday, 11 days out.", phase: "announce", roleKey: "social", offsetDays: -11, dependsOn: ["presave_link", "banners_pre"] },
    { key: "press_release", title: "Press release final", description: "Ready 3–5 business days before release; send to international teams if localization is needed.", phase: "announce", roleKey: "publicist", offsetDays: -7, deliverable: { kind: "document" } },
    { key: "crm_drafts", title: "Email + SMS drafts approved and scheduled", phase: "announce", roleKey: "marketing", offsetDays: -3 },
    { key: "registrations", title: "Luminate / Mediabase registration (if needed)", phase: "announce", roleKey: "marketing", offsetDays: -5 },

    // Release
    { key: "release_qc", title: "Release-night delivery QC across DSPs", description: "Titling, artwork and profile mapping on Spotify, Apple, Amazon, Pandora, YouTube Music, SoundCloud, Tidal, Deezer, Qobuz, Musixmatch.", phase: "release", roleKey: "marketing", offsetDays: 0, checklist: ["Spotify", "Apple Music", "Amazon Music", "Pandora", "YouTube Music / premiere page", "SoundCloud", "Tidal", "Deezer", "Qobuz", "Musixmatch lyrics synced"] },
    { key: "release_day", title: "Out-now posts, link flips, Artist Pick, Canvas upload, Musixmatch", phase: "release", roleKey: "social", offsetDays: 0, dependsOn: ["release_qc"], checklist: ["Out-now posts on every platform", "Link in bio flipped to out now", "Artist Pick set", "Canvas + Clips live", "Complete Collection playlist rebranded", "Email + SMS sent"] },

    // Post
    { key: "report_ff", title: "First Friday report", phase: "post", roleKey: "marketing", offsetDays: 3 },
    { key: "report_fw", title: "First Week report", phase: "post", roleKey: "marketing", offsetDays: 7 },
    { key: "marquee", title: "Spotify Marquee start", phase: "post", roleKey: "marketing", offsetDays: 7 },
    { key: "showcase", title: "Spotify Showcase start", phase: "post", roleKey: "marketing", offsetDays: 14 },
    { key: "pandora_feature", title: "Pandora featured track", description: "Set 3–4 weeks after launch to maximize performance.", phase: "post", roleKey: "marketing", offsetDays: 21 },
  ],
};
