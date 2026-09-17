import { cn } from "@/lib/utils";

/** Three identical dots. Lucide's ellipsis renders uneven at small sizes, so this is pure CSS. */
export function DotsIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-[3px]", className)}>
      <span className="size-[3px] rounded-full bg-current" />
      <span className="size-[3px] rounded-full bg-current" />
      <span className="size-[3px] rounded-full bg-current" />
    </span>
  );
}
