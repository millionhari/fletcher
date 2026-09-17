import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/trpc/server";

export default async function Home() {
  const caller = await getServerCaller();
  const workspaces = await caller.workspace.listMine();
  const first = workspaces[0];
  if (!first) {
    return (
      <main className="flex flex-1 items-center justify-center p-10">
        <div className="surface max-w-md p-8">
          <h1 className="text-lg font-semibold">No workspace yet</h1>
          <p className="mt-2 text-muted-foreground">Run <code className="font-mono">pnpm db:seed</code> to create the demo workspace.</p>
        </div>
      </main>
    );
  }
  redirect(`/w/${first.slug}`);
}
