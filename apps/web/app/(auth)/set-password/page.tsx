import type { Metadata } from "next";
import { Suspense } from "react";
import { SetPasswordForm } from "@/components/fletcher/auth/password-forms";

export const metadata: Metadata = { title: "Set password" };

export default function Page() {
  return <Suspense><SetPasswordForm /></Suspense>;
}
