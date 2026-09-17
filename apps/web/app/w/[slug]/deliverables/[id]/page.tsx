import { ReviewView } from "@/components/fletcher/review/review-view";

export default async function DeliverablePage({ params }: PageProps<"/w/[slug]/deliverables/[id]">) {
  const { id } = await params;
  return <ReviewView deliverableId={id} />;
}
