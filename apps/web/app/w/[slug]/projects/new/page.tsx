import type { Metadata } from "next";
import { NewProjectWizard } from "@/components/fletcher/views/new-project-wizard";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: PageProps<"/w/[slug]/projects/new">) {
  const sp = await searchParams;
  const parent = typeof sp.parent === "string" ? sp.parent : undefined;
  const type = typeof sp.type === "string" ? sp.type : undefined;
  return <NewProjectWizard parentProjectId={parent} initialType={type} />;
}
