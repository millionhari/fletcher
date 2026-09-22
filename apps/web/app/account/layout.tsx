import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Account-level pages sit outside any workspace: a plain frame with a way back. */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-8 py-6">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Back to Fletcher</Link>
        {children}
      </div>
    </main>
  );
}
