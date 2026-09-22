"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** First-run screen: one workspace per artist, and the person creating it becomes owner. */
export function CreateWorkspaceForm({ firstName, hasWorkspaces }: { firstName: string; hasWorkspaces: boolean }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [artistName, setArtistName] = useState("");
  const [name, setName] = useState("");
  const [touchedName, setTouchedName] = useState(false);
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/Chicago";
  const create = useMutation(trpc.workspace.create.mutationOptions({
    onSuccess: (ws) => { router.replace(`/w/${ws.slug}`); router.refresh(); },
    onError: (e) => toast.error(e.message),
  }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ artistName: artistName.trim(), name: (name || artistName).trim(), timezone });
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">{hasWorkspaces ? "New workspace" : `Welcome, ${firstName}`}</h1>
      <p className="mt-1 text-sm text-muted-foreground">A workspace is one artist: their releases, team, deliverables and rollout live here.</p>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="artist">Artist name</Label>
          <Input id="artist" autoFocus required value={artistName} onChange={(e) => { setArtistName(e.target.value); if (!touchedName) setName(e.target.value); }} placeholder="MŌRIAH" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ws">Workspace name <span className="font-normal text-muted-foreground">· optional</span></Label>
          <Input id="ws" value={name} onChange={(e) => { setName(e.target.value); setTouchedName(true); }} placeholder={artistName || "Team name"} />
          <p className="text-2xs text-muted-foreground">Usually the artist. Use something else if this is a label or management team.</p>
        </div>
        <Button type="submit" className="mt-1 w-full" disabled={!artistName.trim() || create.isPending}>{create.isPending && <Loader2 className="animate-spin" />}Create workspace</Button>
      </form>
      {hasWorkspaces && <p className="mt-5 text-center text-xs text-muted-foreground"><Link href="/" className="font-medium text-foreground hover:underline">Back to my workspaces</Link></p>}
    </div>
  );
}
