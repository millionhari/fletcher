import { TemplateEditorView } from "@/components/fletcher/views/template-editor-view";

export default async function TemplatePage({ params }: PageProps<"/w/[slug]/templates/[id]">) {
  const { id } = await params;
  return <TemplateEditorView templateId={id} />;
}
