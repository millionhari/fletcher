import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/fletcher/auth/password-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return <ForgotPasswordForm />;
}
