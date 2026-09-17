"use client";

import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBack } from "@/lib/hooks/use-nav-depth";

/** Standard back affordance for drill-in pages. Returns to the previous in-app page, or the fallback. */
export function BackButton({ fallback, label = "Back", className }: { fallback: string; label?: string; className?: string }) {
  const back = useBack(fallback);
  return (
    <Button variant="ghost" size="sm" onClick={back} className={cn("-ml-2 text-muted-foreground hover:text-foreground", className)} aria-label={label}>
      <ArrowLeft />
      {label}
    </Button>
  );
}
