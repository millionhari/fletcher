import { PLATFORM_LABELS, type Platform } from "@fletcher/core";
import { cn } from "@/lib/utils";

const GLYPH: Record<Platform, string> = {
  instagram: "IG",
  tiktok: "TT",
  facebook: "FB",
  x: "X",
  threads: "@",
  youtube: "YT",
  youtube_music: "YM",
  spotify: "SP",
  apple_music: "AM",
  amazon_music: "AZ",
  pandora: "PD",
  soundcloud: "SC",
  tidal: "TD",
  deezer: "DZ",
  bandsintown: "BT",
  songkick: "SK",
  link_in_bio: "LK",
  website: "WWW",
  email: "@",
  sms: "SMS",
  webstore: "$",
  other: "•",
};

const COLOR: Partial<Record<Platform, string>> = {
  instagram: "bg-[#fde7f3] text-[#b5187a] dark:bg-[#3a1230] dark:text-[#ff7ac6]",
  tiktok: "bg-[#e8e8ea] text-[#101112] dark:bg-[#2b2c30] dark:text-[#f2f2f3]",
  facebook: "bg-[#e6effc] text-[#1b5fc4] dark:bg-[#15294a] dark:text-[#7aa9f7]",
  x: "bg-[#e8e8ea] text-[#101112] dark:bg-[#2b2c30] dark:text-[#f2f2f3]",
  threads: "bg-[#e8e8ea] text-[#101112] dark:bg-[#2b2c30] dark:text-[#f2f2f3]",
  youtube: "bg-[#fde8e8] text-[#c4161c] dark:bg-[#3a1515] dark:text-[#ff6b6b]",
  youtube_music: "bg-[#fde8e8] text-[#c4161c] dark:bg-[#3a1515] dark:text-[#ff6b6b]",
  spotify: "bg-[#e4f7ea] text-[#12853f] dark:bg-[#0f2e1a] dark:text-[#4ade80]",
  apple_music: "bg-[#fde8ec] text-[#c8203b] dark:bg-[#3a1418] dark:text-[#ff7b8f]",
  amazon_music: "bg-[#e3f4fa] text-[#0e6f8f] dark:bg-[#0f2a35] dark:text-[#5ec8ee]",
  pandora: "bg-[#e8e9fb] text-[#3341b8] dark:bg-[#171a3f] dark:text-[#8f9bff]",
  soundcloud: "bg-[#fdeee3] text-[#c7530d] dark:bg-[#3a2013] dark:text-[#ff9b5c]",
  tidal: "bg-[#e8e8ea] text-[#101112] dark:bg-[#2b2c30] dark:text-[#f2f2f3]",
  deezer: "bg-[#f1e8fd] text-[#5b2bb0] dark:bg-[#26163f] dark:text-[#c4a6ff]",
  email: "bg-[#fdf1dc] text-[#8a5a0d] dark:bg-[#3a2b0f] dark:text-[#f5c063]",
  sms: "bg-[#e3f6ec] text-[#0f6b45] dark:bg-[#0f2e1a] dark:text-[#4ade80]",
};

export function PlatformIcon({ platform, className, size = "sm" }: { platform: Platform; className?: string; size?: "xs" | "sm" | "md" }) {
  const sizes = { xs: "h-4 min-w-4 px-0.5 text-[8px]", sm: "h-5 min-w-5 px-1 text-[9px]", md: "h-6 min-w-6 px-1 text-[10px]" };
  return (
    <span title={PLATFORM_LABELS[platform]} className={cn("inline-flex shrink-0 items-center justify-center rounded font-bold leading-none tracking-tight", sizes[size], COLOR[platform] ?? "bg-muted text-muted-foreground", className)}>
      {GLYPH[platform]}
    </span>
  );
}

export function PlatformLabel({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <PlatformIcon platform={platform} size="xs" />
      <span className="text-xs font-medium">{PLATFORM_LABELS[platform]}</span>
    </span>
  );
}
