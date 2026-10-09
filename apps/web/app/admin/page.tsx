import type { Metadata } from "next";
import { AdminView } from "@/components/fletcher/views/admin-view";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return <AdminView />;
}
