import { createCallerFactory, router } from "./trpc";
import { workspaceRouter } from "./routers/workspace";
import { membersRouter } from "./routers/members";
import { templatesRouter } from "./routers/templates";
import { projectsRouter } from "./routers/projects";
import { tasksRouter } from "./routers/tasks";
import { deliverablesRouter } from "./routers/deliverables";
import { commentsRouter } from "./routers/comments";
import { commsRouter } from "./routers/comms";
import { dashboardRouter } from "./routers/dashboard";

export const appRouter = router({
  workspace: workspaceRouter,
  members: membersRouter,
  templates: templatesRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  deliverables: deliverablesRouter,
  comments: commentsRouter,
  comms: commsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
