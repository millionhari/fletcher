"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LinkProvider } from "@fletcher/core";
import { ProviderMark } from "./provider-mark";

/** A brand mark for known hosts; the site's favicon for the rest; a link glyph if even that fails. */
export function LinkProviderIcon({ provider, url, className }: { provider: LinkProvider; url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (provider) return <ProviderMark provider={provider} className={className} />;
  let host: string | null = null;
  try { host = new URL(url).hostname; } catch {}
  if (!host || failed) return <Link2 className={cn("text-muted-foreground", className)} />;
  // eslint-disable-next-line @next/next/no-img-element -- tiny favicon from a well-known service
  return <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`} alt="" className={cn("rounded-sm", className)} onError={() => setFailed(true)} />;
}
