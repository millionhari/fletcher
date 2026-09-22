import type { Metadata } from "next";
import { FilesView } from "@/components/fletcher/views/files-view";

export const metadata: Metadata = { title: "Files" };

export default function FilesPage() {
  return <FilesView />;
}
