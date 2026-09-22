"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, File as FileIcon, Folder, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProviderMark } from "./provider-mark";

/** What every picker hands back: enough to start a copy. */
export interface CloudPick {
  provider: "google_drive" | "box" | "dropbox_chooser";
  id?: string;
  link?: string;
  name: string;
  mimeType?: string;
  bytes?: number;
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(el);
    }));
  }
  return scripts.get(src)!;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- third-party globals */
declare global {
  interface Window { gapi?: any; google?: any; Dropbox?: any }
}

/**
 * Google Picker. Needs a short-lived access token from the person's own
 * connection (drive.file scope), the API key and the project number.
 */
export function useGooglePicker(onPick: (p: CloudPick) => void, onNeedsConnection: () => void) {
  const trpc = useTRPC();
  const token = useMutation(trpc.connections.pickerToken.mutationOptions());
  const [busy, setBusy] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

  const open = async () => {
    if (!apiKey || !appId) { toast.error("Google Drive picker isn't configured"); return; }
    setBusy(true);
    try {
      let accessToken: string;
      try {
        ({ accessToken } = await token.mutateAsync({ provider: "google_drive" }));
      } catch {
        onNeedsConnection();
        return;
      }
      await loadScript("https://apis.google.com/js/api.js");
      await new Promise<void>((resolve) => window.gapi.load("picker", { callback: resolve }));
      const g = window.google.picker;
      const view = new g.DocsView(g.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
      const picker = new g.PickerBuilder()
        .setAppId(appId)
        .setDeveloperKey(apiKey)
        .setOAuthToken(accessToken)
        .addView(view)
        .addView(new g.DocsUploadView())
        .enableFeature(g.Feature.SUPPORT_DRIVES)
        .setCallback((data: any) => {
          if (data.action !== g.Action.PICKED) return;
          const doc = data.docs?.[0];
          if (!doc) return;
          onPick({ provider: "google_drive", id: doc.id, name: doc.name, mimeType: doc.mimeType, bytes: doc.sizeBytes ? Number(doc.sizeBytes) : undefined });
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open Google Drive");
    } finally {
      setBusy(false);
    }
  };
  return { open, busy, available: !!(apiKey && appId) };
}

/** Dropbox Chooser: signs in inside its own popup and returns a direct download link, so nothing to connect. */
export function useDropboxChooser(onPick: (p: CloudPick) => void) {
  const [busy, setBusy] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
  const open = async () => {
    if (!appKey) { toast.error("Dropbox chooser isn't configured"); return; }
    setBusy(true);
    try {
      if (!window.Dropbox) {
        const el = document.createElement("script");
        el.src = "https://www.dropbox.com/static/api/2/dropins.js";
        el.id = "dropboxjs";
        el.dataset.appKey = appKey;
        await new Promise<void>((resolve, reject) => { el.onload = () => resolve(); el.onerror = () => reject(new Error("Could not load Dropbox")); document.head.appendChild(el); });
      }
      window.Dropbox.choose({
        linkType: "direct",
        multiselect: false,
        success: (files: { link: string; name: string; bytes: number }[]) => {
          const f = files[0];
          if (f) onPick({ provider: "dropbox_chooser", link: f.link, name: f.name, bytes: f.bytes });
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open Dropbox");
    } finally {
      setBusy(false);
    }
  };
  return { open, busy, available: !!appKey };
}

/**
 * Box folder browser. Box's own picker component doesn't fit our React
 * version, so this is a small one of ours over the Box API via tRPC.
 */
export function BoxBrowser({ open, onOpenChange, onPick, onNeedsConnection }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (p: CloudPick) => void; onNeedsConnection: () => void }) {
  const trpc = useTRPC();
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: "0", name: "All files" }]);
  const current = path[path.length - 1]!;
  const q = useQuery({ ...trpc.connections.boxList.queryOptions({ folderId: current.id }), enabled: open, retry: false });

  useEffect(() => {
    if (q.error && /Connect Box/i.test(q.error.message)) { onOpenChange(false); onNeedsConnection(); }
  }, [q.error, onOpenChange, onNeedsConnection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ProviderMark provider="box" className="size-5" />Choose from Box</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1 text-2xs">
            {path.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3" />}
                <button type="button" onClick={() => setPath(path.slice(0, i + 1))} className={cn("hover:text-foreground", i === path.length - 1 && "text-foreground")}>{p.name}</button>
              </span>
            ))}
          </DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin max-h-80 overflow-y-auto rounded-lg border border-border">
          {q.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
          ) : q.error ? (
            <p className="px-4 py-8 text-center text-xs text-danger">{q.error.message}</p>
          ) : !q.data?.entries.length ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Empty folder.</p>
          ) : (
            q.data.entries.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => (e.type === "folder" ? setPath([...path, { id: e.id, name: e.name }]) : onPick({ provider: "box", id: e.id, name: e.name, bytes: e.size }))}
                className="flex w-full items-center gap-2.5 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/60"
              >
                {e.type === "folder" ? <Folder className="size-4 text-brand" /> : <FileIcon className="size-4 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate text-xs">{e.name}</span>
                {e.type === "file" && e.size != null && <span className="tabular text-2xs text-muted-foreground">{fmtBytes(e.size)}</span>}
                {e.type === "folder" && <ChevronRight className="size-3.5 text-muted-foreground" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Connect Google Drive to pick files" — shown when a picker needs a connection that isn't there. */
export function ConnectPrompt({ provider, open, onOpenChange }: { provider: "google_drive" | "box"; open: boolean; onOpenChange: (o: boolean) => void }) {
  const label = provider === "google_drive" ? "Google Drive" : "Box";
  const returnTo = typeof window !== "undefined" ? window.location.pathname : "/";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ProviderMark provider={provider} className="size-5" />Connect {label}</DialogTitle>
          <DialogDescription>Link your {label} account once and you can pick files from it here. Only files you choose are shared with Fletcher.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Not now</Button>
          <Button asChild size="sm"><a href={`/api/connections/${provider}/start?return=${encodeURIComponent(returnTo)}`}>Connect {label}</a></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
