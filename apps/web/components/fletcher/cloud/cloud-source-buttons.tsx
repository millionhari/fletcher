"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderMark } from "./provider-mark";
import { BoxBrowser, ConnectPrompt, useDropboxChooser, useGooglePicker, type CloudPick } from "./pickers";

/**
 * The "From Google Drive / Dropbox / Box" row. Whatever is picked gets copied
 * into Fletcher storage; the caller starts that with imports.fromProvider.
 */
export function CloudSourceButtons({ onPick, disabled, size = "xs" }: { onPick: (p: CloudPick) => void; disabled?: boolean; size?: "xs" | "sm" }) {
  const [needs, setNeeds] = useState<"google_drive" | "box" | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const google = useGooglePicker(onPick, () => setNeeds("google_drive"));
  const dropbox = useDropboxChooser(onPick);
  const anyConfigured = google.available || dropbox.available;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-2xs text-muted-foreground">From</span>
      <Button type="button" variant="outline" size={size} disabled={disabled || !google.available || google.busy} onClick={google.open} title={google.available ? undefined : "Not configured"}>
        {google.busy ? <Loader2 className="animate-spin" /> : <ProviderMark provider="google_drive" className="size-3.5" />}Google Drive
      </Button>
      <Button type="button" variant="outline" size={size} disabled={disabled || !dropbox.available || dropbox.busy} onClick={dropbox.open} title={dropbox.available ? undefined : "Not configured"}>
        {dropbox.busy ? <Loader2 className="animate-spin" /> : <ProviderMark provider="dropbox" className="size-3.5" />}Dropbox
      </Button>
      <Button type="button" variant="outline" size={size} disabled={disabled} onClick={() => setBoxOpen(true)}>
        <ProviderMark provider="box" className="size-3.5" />Box
      </Button>
      {!anyConfigured && <span className="text-2xs text-muted-foreground">Cloud pickers aren&apos;t set up yet.</span>}
      <BoxBrowser open={boxOpen} onOpenChange={setBoxOpen} onPick={(p) => { setBoxOpen(false); onPick(p); }} onNeedsConnection={() => setNeeds("box")} />
      {needs && <ConnectPrompt provider={needs} open onOpenChange={(o) => { if (!o) setNeeds(null); }} />}
    </div>
  );
}
