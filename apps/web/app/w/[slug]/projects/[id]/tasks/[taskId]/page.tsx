import { TaskPage } from "@/components/fletcher/task/task-page";

export default async function TaskRoute({ params }: PageProps<"/w/[slug]/projects/[id]/tasks/[taskId]">) {
  const { taskId } = await params;
  return <TaskPage taskId={taskId} />;
}
