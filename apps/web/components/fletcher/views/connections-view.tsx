"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/fletcher/page-header";
import { Pill } from "@/components/fletcher/status-badge";
import { ProviderMark } from "@/components/fletcher/cloud/provider-mark";

/** One card per cloud. Dropbox has no card to connect: its Chooser signs in on its own. */
export function ConnectionsView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const params = useSearchParams();
  const q = useQuery(trpc.connections.list.queryOptions());
  const disconnect = useMutation(trpc.connections.disconnect.mutationOptions({ onSuccess: async () => { await qc.invalidateQueries({ queryKey: trpc.connections.pathKey() }); toast.success("Disconnected"); }, onError: (e) => toast.error(e.message) }));

  const error = params.get("error");
  useEffect(() => {
    if (!error) return;
    toast.error(error === "state" ? "That sign-in link expired — try again." : error === "not_configured" ? "This provider isn't set up yet." : `Couldn't connect: ${error}`);
  }, [error]);

  return (
    <div className="fade-in-up">
      <PageHeader title="Connections" description="Link your own cloud accounts to pull files straight into deliverables. Connections are yours alone — teammates connect their own." />
      {q.isLoading || !q.data ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.map((c) => (
            <div key={c.provider} className="surface flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ProviderMark provider={c.provider} className="size-8" />
                  <div>
                    <div className="text-sm font-semibold">{c.label}</div>
                    <div className="text-2xs text-muted-foreground">{c.connected ? c.accountLabel ?? "Connected" : c.configured ? "Not connected" : "Not available yet"}</div>
                  </div>
                </div>
                {c.connected && <Pill tone="success" dot={false}><Check className="size-2.5" />Connected</Pill>}
              </div>
              <div className="flex items-center gap-2">
                {c.connected ? (
                  <Button variant="ghost" size="xs" disabled={disconnect.isPending} onClick={() => disconnect.mutate({ provider: c.provider })}>{disconnect.isPending ? <Loader2 className="animate-spin" /> : <Unplug />}Disconnect</Button>
                ) : (
                  <Button asChild size="xs" disabled={!c.configured}><a href={`/api/connections/${c.provider}/start`}>Connect {c.label}</a></Button>
                )}
              </div>
            </div>
          ))}
          <div className="surface flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <ProviderMark provider="dropbox" className="size-8" />
              <div>
                <div className="text-sm font-semibold">Dropbox</div>
                <div className="text-2xs text-muted-foreground">Nothing to connect — the Dropbox chooser signs you in when you use it.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
