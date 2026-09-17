"use client";

import { Suspense } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useTaskParam } from "@/lib/hooks/use-task-param";
import { TaskPanel } from "@/components/fletcher/task/task-panel";

function Inner() {
  const { taskId, setTaskId } = useTaskParam();
  return (
    <Sheet open={!!taskId} onOpenChange={(o) => { if (!o) setTaskId(null); }}>
      <SheetContent side="right" showCloseButton={false} className="gap-0 overflow-y-auto p-0 data-[side=right]:w-[min(1040px,94vw)] data-[side=right]:sm:max-w-[min(1040px,94vw)]">
        <SheetTitle className="sr-only">Task</SheetTitle>
        {taskId && <TaskPanel key={taskId} taskId={taskId} mode="sheet" onClose={() => setTaskId(null)} onNavigate={(id) => setTaskId(id)} />}
      </SheetContent>
    </Sheet>
  );
}

/** Mounted once per project layout; opens whenever `?task=<id>` is in the URL. */
export function TaskPanelSheet() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
