export type AssetGroup = "profile" | "banner" | "dsp" | "canvas" | "ads" | "press" | "artwork" | "misc";
export type AssetMediaType = "image" | "video" | "any";
export type AssetScope = "workspace" | "prerelease" | "release";

export interface AssetSpec {
  key: string;
  label: string;
  platform: string;
  group: AssetGroup;
  mediaType: AssetMediaType;
  /** Exact pixel dimensions when the platform requires them. */
  width?: number;
  height?: number;
  /** Minimum dimensions when the platform only sets a floor. */
  minWidth?: number;
  minHeight?: number;
  /** Aspect ratio as w/h when dimensions are flexible. */
  aspect?: number;
  maxBytes?: number;
  minSeconds?: number;
  maxSeconds?: number;
  formats?: string[];
  notes?: string;
  /** Which sets this spec belongs to. */
  scopes: AssetScope[];
}

const MB = 1024 * 1024;

const profile = (key: string, platform: string, notes?: string): AssetSpec => ({
  key,
  label: `${platform} profile image`,
  platform,
  group: "profile",
  mediaType: "image",
  width: 1000,
  height: 1000,
  maxBytes: 4 * MB,
  formats: ["png", "jpg"],
  notes,
  scopes: ["workspace"],
});

export const ASSET_SPECS: AssetSpec[] = [
  // Profile images: 1000x1000 everywhere (playbook asset checklist)
  profile("profile_instagram", "Instagram", "Cropped to a circle; keep the subject centered."),
  profile("profile_tiktok", "TikTok"),
  profile("profile_facebook", "Facebook"),
  profile("profile_x", "X / Twitter"),
  profile("profile_youtube", "YouTube"),
  profile("profile_spotify", "Spotify", "Square, 4 MB or less."),
  profile("profile_apple_music", "Apple Music"),
  profile("profile_amazon_music", "Amazon Music"),
  profile("profile_pandora", "Pandora"),
  profile("profile_soundcloud", "SoundCloud"),
  profile("profile_bandsintown", "Bandsintown"),
  profile("profile_songkick", "Songkick"),

  // Banners / headers (pre-release with presave CTA and release "out now" variants)
  {
    key: "banner_facebook",
    label: "Facebook cover",
    platform: "Facebook",
    group: "banner",
    mediaType: "image",
    width: 851,
    height: 315,
    notes: "Crops to 640x360 centered on mobile; keep text inside the center.",
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_x",
    label: "X / Twitter header",
    platform: "X / Twitter",
    group: "banner",
    mediaType: "image",
    width: 1500,
    height: 500,
    maxBytes: 10 * MB,
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_youtube",
    label: "YouTube channel banner",
    platform: "YouTube",
    group: "banner",
    mediaType: "image",
    width: 2560,
    height: 1440,
    maxBytes: 6 * MB,
    notes: "Safe area for text and logos is the center 1546x423.",
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_spotify",
    label: "Spotify artist header",
    platform: "Spotify",
    group: "banner",
    mediaType: "image",
    width: 2660,
    height: 1140,
    maxBytes: 20 * MB,
    notes: "No text; Spotify crops aggressively on different screens.",
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_amazon",
    label: "Amazon Music background",
    platform: "Amazon Music",
    group: "banner",
    mediaType: "image",
    minWidth: 1920,
    minHeight: 1440,
    maxBytes: 15 * MB,
    notes: "Artist face in the upper 50% or no face/logo/text at all.",
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_apple_music",
    label: "Apple Music background",
    platform: "Apple Music",
    group: "banner",
    mediaType: "image",
    minWidth: 2400,
    minHeight: 933,
    notes: "Delivered via Apple Music for Artists; landscape, no text.",
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_pandora",
    label: "Pandora header",
    platform: "Pandora",
    group: "banner",
    mediaType: "image",
    minWidth: 1600,
    minHeight: 900,
    aspect: 16 / 9,
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_soundcloud",
    label: "SoundCloud header",
    platform: "SoundCloud",
    group: "banner",
    mediaType: "image",
    width: 2480,
    height: 520,
    maxBytes: 2 * MB,
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_email",
    label: "Email header",
    platform: "Email",
    group: "banner",
    mediaType: "image",
    width: 600,
    height: 200,
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_link_in_bio",
    label: "Link-in-bio header",
    platform: "Link in bio",
    group: "banner",
    mediaType: "image",
    aspect: 16 / 9,
    notes: "Komi / co:brand / set.bio header. Use single or album artwork.",
    scopes: ["prerelease", "release"],
  },
  {
    key: "banner_website",
    label: "Website banner",
    platform: "Website",
    group: "banner",
    mediaType: "image",
    notes: "Size varies by site theme.",
    scopes: ["prerelease", "release"],
  },

  // DSP-specific
  {
    key: "dsp_spotify_playlist_cover",
    label: "Spotify playlist cover (Complete Collection)",
    platform: "Spotify",
    group: "dsp",
    mediaType: "image",
    width: 1000,
    height: 1000,
    scopes: ["release"],
  },
  {
    key: "dsp_spotify_canvas",
    label: "Spotify Canvas",
    platform: "Spotify",
    group: "canvas",
    mediaType: "video",
    width: 1080,
    height: 1920,
    minSeconds: 3,
    maxSeconds: 8,
    formats: ["mp4", "jpg"],
    notes: "9:16 vertical loop, at least 720x1280. One per track.",
    scopes: ["release"],
  },
  {
    key: "dsp_spotify_clip",
    label: "Spotify Clip",
    platform: "Spotify",
    group: "canvas",
    mediaType: "video",
    width: 1080,
    height: 1920,
    maxSeconds: 30,
    formats: ["mp4"],
    notes: "Vertical video, under 30 seconds, from the Spotify for Artists app.",
    scopes: ["prerelease", "release"],
  },
  {
    key: "dsp_apple_motion_artwork",
    label: "Apple Music motion artwork",
    platform: "Apple Music",
    group: "canvas",
    mediaType: "video",
    width: 3840,
    height: 3840,
    minSeconds: 15,
    maxSeconds: 35,
    formats: ["mov", "mp4"],
    notes: "Square and 3:4 tall versions; no hard cuts, no text.",
    scopes: ["release"],
  },
  {
    key: "dsp_exclusive_photos",
    label: "DSP exclusive photos",
    platform: "All DSPs",
    group: "press",
    mediaType: "image",
    minWidth: 3000,
    minHeight: 2000,
    notes: "4 to 5 tight close-ups, at least one horizontal. No logos, filters, or text. Allocate exclusives to Spotify, Amazon, Pandora, Apple if you can.",
    scopes: ["prerelease"],
  },

  // Press
  {
    key: "press_photos",
    label: "Press photos",
    platform: "Press",
    group: "press",
    mediaType: "image",
    minWidth: 3000,
    minHeight: 2000,
    notes: "2 to 3 approved shots with a horizontal option.",
    scopes: ["workspace"],
  },

  // Artwork / distribution
  {
    key: "artwork_cover",
    label: "Cover artwork",
    platform: "Distribution",
    group: "artwork",
    mediaType: "image",
    width: 3000,
    height: 3000,
    formats: ["jpg", "png"],
    notes: "RGB, 3000x3000 minimum for DSPs. Keep the layered 300dpi source too.",
    scopes: ["release"],
  },
  {
    key: "artwork_layered_source",
    label: "Layered cover source",
    platform: "Distribution",
    group: "artwork",
    mediaType: "any",
    notes: "Hi-res layered file (PSD / AI), 300dpi.",
    scopes: ["release"],
  },
  {
    key: "artwork_logo",
    label: "Logo (transparent)",
    platform: "Brand",
    group: "artwork",
    mediaType: "image",
    notes: "Hi-res layered, transparent PNG or vector.",
    scopes: ["workspace"],
  },
  {
    key: "artwork_fonts",
    label: "Font files used in artwork",
    platform: "Brand",
    group: "artwork",
    mediaType: "any",
    scopes: ["workspace"],
  },

  // Ads
  {
    key: "ads_vertical_15",
    label: "Ad cutdown :15 vertical",
    platform: "Meta / TikTok / YouTube",
    group: "ads",
    mediaType: "video",
    width: 1080,
    height: 1920,
    maxSeconds: 15,
    scopes: ["release"],
  },
  {
    key: "ads_square_30",
    label: "Ad cutdown :30 square / 4:5",
    platform: "Meta / YouTube",
    group: "ads",
    mediaType: "video",
    width: 1080,
    height: 1080,
    maxSeconds: 30,
    notes: "Square preferred; 4:5 (1080x1350) or 16:9 also accepted.",
    scopes: ["release"],
  },
  {
    key: "video_thumbnail",
    label: "YouTube thumbnail",
    platform: "YouTube",
    group: "misc",
    mediaType: "image",
    width: 1280,
    height: 720,
    maxBytes: 2 * MB,
    scopes: ["release"],
  },
];

export const ASSET_SPEC_BY_KEY: Record<string, AssetSpec> = Object.fromEntries(
  ASSET_SPECS.map((s) => [s.key, s]),
);

export function specsForScope(scope: AssetScope): AssetSpec[] {
  return ASSET_SPECS.filter((s) => s.scopes.includes(scope));
}

export type SpecCheckStatus = "ok" | "wrong_dimensions" | "too_large" | "too_long" | "too_short" | "unknown";

export interface SpecCheckInput {
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  durationSeconds?: number | null;
}

export interface SpecCheckResult {
  status: SpecCheckStatus;
  expected: string;
  actual: string;
  message: string;
}

export function describeSpec(spec: AssetSpec): string {
  const parts: string[] = [];
  if (spec.width && spec.height) parts.push(`${spec.width}×${spec.height}`);
  else if (spec.minWidth && spec.minHeight) parts.push(`≥ ${spec.minWidth}×${spec.minHeight}`);
  else if (spec.aspect) parts.push(`${spec.aspect >= 1 ? spec.aspect.toFixed(2) : `1:${(1 / spec.aspect).toFixed(2)}`} ratio`);
  else parts.push("any size");
  if (spec.maxBytes) parts.push(`≤ ${Math.round(spec.maxBytes / MB)} MB`);
  if (spec.minSeconds || spec.maxSeconds) {
    parts.push(`${spec.minSeconds ?? 0}–${spec.maxSeconds ?? "∞"} s`);
  }
  return parts.join(" · ");
}

export function checkAgainstSpec(spec: AssetSpec, input: SpecCheckInput): SpecCheckResult {
  const expected = describeSpec(spec);
  const actualParts: string[] = [];
  if (input.width && input.height) actualParts.push(`${input.width}×${input.height}`);
  if (input.bytes) actualParts.push(`${(input.bytes / MB).toFixed(1)} MB`);
  if (input.durationSeconds) actualParts.push(`${Math.round(input.durationSeconds)} s`);
  const actual = actualParts.join(" · ") || "unknown";

  if (spec.mediaType !== "any" && (!input.width || !input.height)) {
    return { status: "unknown", expected, actual, message: "Could not read dimensions." };
  }
  if (spec.width && spec.height && input.width && input.height) {
    if (input.width !== spec.width || input.height !== spec.height) {
      return {
        status: "wrong_dimensions",
        expected,
        actual,
        message: `Wrong dimensions. Expected ${spec.width}×${spec.height}, got ${input.width}×${input.height}.`,
      };
    }
  } else if (spec.minWidth && spec.minHeight && input.width && input.height) {
    if (input.width < spec.minWidth || input.height < spec.minHeight) {
      return {
        status: "wrong_dimensions",
        expected,
        actual,
        message: `Too small. Needs at least ${spec.minWidth}×${spec.minHeight}, got ${input.width}×${input.height}.`,
      };
    }
  } else if (spec.aspect && input.width && input.height) {
    const ratio = input.width / input.height;
    if (Math.abs(ratio - spec.aspect) > 0.03) {
      return {
        status: "wrong_dimensions",
        expected,
        actual,
        message: `Wrong aspect ratio. Expected ${spec.aspect.toFixed(2)}, got ${ratio.toFixed(2)}.`,
      };
    }
  }
  if (spec.maxBytes && input.bytes && input.bytes > spec.maxBytes) {
    return {
      status: "too_large",
      expected,
      actual,
      message: `File too large. Max ${Math.round(spec.maxBytes / MB)} MB, got ${(input.bytes / MB).toFixed(1)} MB.`,
    };
  }
  if (spec.maxSeconds && input.durationSeconds && input.durationSeconds > spec.maxSeconds) {
    return { status: "too_long", expected, actual, message: `Too long. Max ${spec.maxSeconds} s.` };
  }
  if (spec.minSeconds && input.durationSeconds && input.durationSeconds < spec.minSeconds) {
    return { status: "too_short", expected, actual, message: `Too short. Min ${spec.minSeconds} s.` };
  }
  return { status: "ok", expected, actual, message: "Meets spec." };
}
