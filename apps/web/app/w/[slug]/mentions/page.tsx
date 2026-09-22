import type { Metadata } from "next";
import { MentionsView } from "@/components/fletcher/views/mentions-view";

export const metadata: Metadata = { title: "Mentions" };

export default function MentionsPage() {
  return <MentionsView />;
}
