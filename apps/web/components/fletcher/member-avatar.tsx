import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const HUES = ["bg-[#e9f0fd] text-[#2456b8]", "bg-[#e3f6ec] text-[#0f6b45]", "bg-[#fdf1dc] text-[#8a5a0d]", "bg-[#f1e8fd] text-[#5b2bb0]", "bg-[#fdeceb] text-[#a3251b]", "bg-[#e6f4f7] text-[#155e6d]"];

function hue(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length]!;
}

export function MemberAvatar({ name, avatarUrl, size = "sm", className, showTooltip = true }: { name: string | null | undefined; avatarUrl?: string | null; size?: "xs" | "sm" | "md" | "lg"; className?: string; showTooltip?: boolean }) {
  const sizes = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" };
  const label = name ?? "Unassigned";
  const el = (
    <span className={cn("inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold ring-2 ring-background", sizes[size], name ? hue(name) : "bg-muted text-muted-foreground border border-dashed border-border", className)} aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary hosts */}
      {name && avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : name ? initials(name) : "·"}
    </span>
  );
  if (!showTooltip) return el;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{el}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AvatarStack({ names, max = 4 }: { names: (string | null | undefined)[]; max?: number }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="inline-flex -space-x-1.5">
      {shown.map((n, i) => <MemberAvatar key={i} name={n} size="xs" />)}
      {rest > 0 && <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background">+{rest}</span>}
    </span>
  );
}
