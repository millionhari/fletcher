import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { TRPCError } from "@trpc/server";
import { getServerCaller } from "@/lib/trpc/server";

/** Staff-only area. The server checks the allow-list before rendering anything. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const caller = await getServerCaller();
  try {
    const me = await caller.account.me();
    if (!me.isSuperadmin) redirect("/");
  } catch (e) {
    if (e instanceof TRPCError && e.code === "UNAUTHORIZED") redirect("/login?next=%2Fadmin");
    throw e;
  }
  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Back to Fletcher</Link>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2 py-0.5 text-2xs font-medium text-brand"><ShieldCheck className="size-3" />Staff view</span>
        </div>
        {children}
      </div>
    </main>
  );
}
