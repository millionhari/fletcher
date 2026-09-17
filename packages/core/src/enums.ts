export const MEMBER_ROLES = [
  "artist",
  "manager",
  "marketing",
  "social",
  "videographer",
  "photographer",
  "producer",
  "mix_engineer",
  "mastering_engineer",
  "label_distributor",
  "publicist",
  "booking_agent",
  "business_manager",
  "publisher_sync",
  "legal",
  "merch",
  "web",
  "other",
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  artist: "Artist",
  manager: "Manager",
  marketing: "Marketing",
  social: "Socials",
  videographer: "Videographer",
  photographer: "Photographer",
  producer: "Producer",
  mix_engineer: "Mix engineer",
  mastering_engineer: "Mastering engineer",
  label_distributor: "Label / Distributor",
  publicist: "Publicist",
  booking_agent: "Booking agent",
  business_manager: "Business manager",
  publisher_sync: "Publishing / Sync",
  legal: "Legal",
  merch: "Merch",
  web: "Web",
  other: "Other",
};

export const PERMISSIONS = ["owner", "admin", "member", "guest"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PROJECT_TYPES = ["single", "album", "ep", "music_video", "tour", "campaign", "custom"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  single: "Single release",
  album: "Album release",
  ep: "EP release",
  music_video: "Music video",
  tour: "Tour announce",
  campaign: "Campaign",
  custom: "Custom",
};

export const PROJECT_STATUSES = ["planning", "active", "released", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
};

export const DELIVERABLE_KINDS = ["video", "image", "audio", "document", "link"] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const DELIVERABLE_STATUSES = ["draft", "in_review", "changes_requested", "approved"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];
export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const VERSION_SOURCES = ["youtube", "vimeo", "upload", "url"] as const;
export type VersionSource = (typeof VERSION_SOURCES)[number];

export const TEMPLATE_KINDS = ["timeline", "comms"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const PLATFORMS = [
  "instagram",
  "tiktok",
  "facebook",
  "x",
  "threads",
  "youtube",
  "youtube_music",
  "spotify",
  "apple_music",
  "amazon_music",
  "pandora",
  "soundcloud",
  "tidal",
  "deezer",
  "bandsintown",
  "songkick",
  "link_in_bio",
  "website",
  "email",
  "sms",
  "webstore",
  "other",
] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X / Twitter",
  threads: "Threads",
  youtube: "YouTube",
  youtube_music: "YouTube Music",
  spotify: "Spotify",
  apple_music: "Apple Music",
  amazon_music: "Amazon Music",
  pandora: "Pandora",
  soundcloud: "SoundCloud",
  tidal: "Tidal",
  deezer: "Deezer",
  bandsintown: "Bandsintown",
  songkick: "Songkick",
  link_in_bio: "Link in bio",
  website: "Website",
  email: "Email",
  sms: "SMS",
  webstore: "Webstore",
  other: "Other",
};

export const MOMENT_STATUSES = ["planned", "ready", "posted", "skipped"] as const;
export type MomentStatus = (typeof MOMENT_STATUSES)[number];
