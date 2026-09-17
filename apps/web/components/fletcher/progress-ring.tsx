import { cn } from "@/lib/utils";

export function ProgressRing({ value, size = 20, stroke = 2.5, className, tone = "brand" }: { value: number; size?: number; stroke?: number; className?: string; tone?: "brand" | "success" | "muted" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pctValue = Math.max(0, Math.min(100, value));
  const colors = { brand: "text-brand", success: "text-success", muted: "text-muted-foreground" };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("shrink-0 -rotate-90", className)} aria-label={`${pctValue}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pctValue) / 100} className={cn("stroke-current transition-[stroke-dashoffset] duration-500", pctValue >= 100 ? "text-success" : colors[tone])} />
    </svg>
  );
}

export function ProgressBar({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "success" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", v >= 100 ? "bg-success" : tone === "brand" ? "bg-brand" : "bg-success")} style={{ width: `${v}%` }} />
    </div>
  );
}
