import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/fletcher/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <Suspense><AuthForm mode="login" /></Suspense>;
}
