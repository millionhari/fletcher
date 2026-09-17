import type { Metadata } from "next";
import { ProjectsListView } from "@/components/fletcher/views/projects-list-view";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return <ProjectsListView />;
}
