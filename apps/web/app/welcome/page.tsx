import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { getServerCaller } from "@/lib/trpc/server";
import { CreateWorkspaceForm } from "@/components/fletcher/auth/create-workspace-form";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function WelcomePage() {
  const caller = await getServerCaller();
  let me: Awaited<ReturnType<typeof caller.account.me>>;
  let existing: Awaited<ReturnType<typeof caller.workspace.listMine>>;
  try {
    [me, existing] = await Promise.all([caller.account.me(), caller.workspace.listMine()]);
  } catch (e) {
    if (e instanceof TRPCError && e.code === "UNAUTHORIZED") redirect("/login?next=%2Fwelcome");
    throw e;
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-8 font-heading text-lg font-bold tracking-tight">Fletcher</div>
      <div className="surface w-full max-w-md p-6">
        <CreateWorkspaceForm firstName={me.name.split(" ")[0] ?? me.name} hasWorkspaces={existing.length > 0} />
      </div>
    </main>
  );
}
