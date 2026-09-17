"use client";

import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useProjectId } from "@/lib/hooks/use-project";
import { TaskPanel } from "@/components/fletcher/task/task-panel";

export function TaskPage({ taskId }: { taskId: string }) {
  const router = useRouter();
  const ws = useWorkspace();
  const projectId = useProjectId();
  const base = `/w/${ws.slug}/projects/${projectId}`;
  return (
    <div className="surface -mt-2 overflow-hidden">
      <TaskPanel taskId={taskId} mode="page" onClose={() => router.push(`${base}/timeline`)} onNavigate={(id) => router.push(`${base}/tasks/${id}`)} />
    </div>
  );
}
