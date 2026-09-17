"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useProjectId } from "@/lib/hooks/use-project";

export function useProjectData() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const projectId = useProjectId();
  const query = useQuery(trpc.projects.get.queryOptions({ workspace: ws.slug, projectId }));
  return { ...query, projectId, ws, trpc };
}

export function useInvalidateProject() {
  const qc = useQueryClient();
  const trpc = useTRPC();
  const ws = useWorkspace();
  const projectId = useProjectId();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: trpc.projects.get.queryKey({ workspace: ws.slug, projectId }) }),
      qc.invalidateQueries({ queryKey: trpc.projects.list.queryKey() }),
      qc.invalidateQueries({ queryKey: trpc.dashboard.overview.queryKey() }),
      qc.invalidateQueries({ queryKey: trpc.comms.getPlan.queryKey({ workspace: ws.slug, projectId }) }),
      qc.invalidateQueries({ queryKey: trpc.taskDetail.get.queryKey() }),
    ]);
  };
}

export function useMembers() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  return useQuery(trpc.members.list.queryOptions({ workspace: ws.slug }));
}
