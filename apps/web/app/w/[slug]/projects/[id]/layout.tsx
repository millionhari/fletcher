import { ProjectIdProvider } from "@/lib/hooks/use-project";
import { ProjectHeader } from "@/components/fletcher/project-header";

export default async function ProjectLayout({ children, params }: LayoutProps<"/w/[slug]/projects/[id]">) {
  const { id } = await params;
  return (
    <ProjectIdProvider id={id}>
      <ProjectHeader />
      {children}
    </ProjectIdProvider>
  );
}
