import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { getServerCaller } from "@/lib/trpc/server";
import { Sidebar } from "@/components/fletcher/sidebar";
import { WorkspaceProvider } from "@/lib/hooks/use-workspace";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[slug]">) {
  const { slug } = await params;
  const caller = await getServerCaller();
  let data: Awaited<ReturnType<typeof caller.workspace.get>>;
  try {
    data = await caller.workspace.get({ workspace: slug });
  } catch (e) {
    if (e instanceof TRPCError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
  const [workspaces, projects] = await Promise.all([caller.workspace.listMine(), caller.projects.list({ workspace: slug, includeArchived: false })]);

  return (
    <WorkspaceProvider value={{ slug, id: data.workspace.id, name: data.workspace.name, artistName: data.workspace.artistName, timezone: data.workspace.timezone, memberId: data.member.id, userName: data.user.name }}>
      <div className="flex min-h-screen">
        <Sidebar
          workspace={{ slug: data.workspace.slug, name: data.workspace.name, artistName: data.workspace.artistName }}
          workspaces={workspaces.map((w) => ({ slug: w.slug, name: w.name, artistName: w.artistName }))}
          projects={projects.map((p) => ({ id: p.id, name: p.name, type: p.type, color: p.color, anchorDate: p.anchorDate, parentProjectId: p.parentProjectId }))}
          userName={data.user.name}
        />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1280px] px-8 py-6">{children}</div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}
