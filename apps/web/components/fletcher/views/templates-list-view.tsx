"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Copy, Lock, Star } from "lucide-react";
import { toast } from "sonner";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionHeader } from "@/components/fletcher/page-header";
import { Pill } from "@/components/fletcher/status-badge";

export function TemplatesListView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery(trpc.templates.list.queryOptions({ workspace: ws.slug }));
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.templates.list.queryKey() });
  const duplicate = useMutation(trpc.templates.duplicateToWorkspace.mutationOptions({ onSuccess: async (t) => { await invalidate(); toast.success("Copied to your workspace"); router.push(`/w/${ws.slug}/templates/${t.id}`); }, onError: (e) => toast.error(e.message) }));
  const setDefault = useMutation(trpc.templates.setDefault.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("Set as default"); }, onError: (e) => toast.error(e.message) }));

  return (
    <div className="fade-in-up">
      <PageHeader title="Templates" description="Every project starts from a timeline template (dated tasks) and a comms template (rollout moments). System templates carry the industry defaults; copy one to change offsets, roles or checklists for this artist." />
      {q.isLoading || !q.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-8">
          {PROJECT_TYPES.map((type) => {
            const rows = q.data.filter((t) => t.projectType === type);
            if (!rows.length) return null;
            return (
              <section key={type}>
                <SectionHeader title={PROJECT_TYPE_LABELS[type]} count={rows.length} />
                <div className="grid gap-3 md:grid-cols-2">
                  {rows.map((t) => {
                    const def = t.definition as { tasks?: unknown[]; moments?: unknown[] };
                    const count = t.kind === "timeline" ? def.tasks?.length ?? 0 : def.moments?.length ?? 0;
                    return (
                      <div key={t.id} className="surface flex flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/w/${ws.slug}/templates/${t.id}`} className="truncate text-sm font-semibold hover:underline">{t.name}</Link>
                              <Pill tone={t.kind === "timeline" ? "info" : "brand"} dot={false}>{t.kind === "timeline" ? "Timeline" : "Comms"}</Pill>
                              {t.isSystem ? <Pill tone="neutral" dot={false}><Lock className="size-2.5" />System</Pill> : t.isDefault ? <Pill tone="success" dot={false}><Star className="size-2.5" />Default</Pill> : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                          </div>
                          <span className="tabular shrink-0 text-2xs text-muted-foreground">{count} {t.kind === "timeline" ? "tasks" : "moments"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="xs"><Link href={`/w/${ws.slug}/templates/${t.id}`}>{t.isSystem ? "View" : "Edit"}</Link></Button>
                          <Button variant="ghost" size="xs" onClick={() => duplicate.mutate({ workspace: ws.slug, templateId: t.id })}><Copy />Duplicate</Button>
                          {!t.isSystem && !t.isDefault && <Button variant="ghost" size="xs" onClick={() => setDefault.mutate({ workspace: ws.slug, templateId: t.id })}><Star />Make default</Button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
