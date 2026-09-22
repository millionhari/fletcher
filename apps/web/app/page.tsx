import { redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { getServerCaller } from "@/lib/trpc/server";

/** Signed out → login. Signed in → first workspace, or the welcome screen to make one. */
export default async function Home() {
  const caller = await getServerCaller();
  let workspaces: Awaited<ReturnType<typeof caller.workspace.listMine>>;
  try {
    workspaces = await caller.workspace.listMine();
  } catch (e) {
    if (e instanceof TRPCError && e.code === "UNAUTHORIZED") redirect("/login");
    throw e;
  }
  const first = workspaces[0];
  if (!first) redirect("/welcome");
  redirect(`/w/${first.slug}`);
}
