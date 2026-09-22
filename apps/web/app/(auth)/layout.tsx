import Link from "next/link";

/** Sign-in pages: no sidebar, one centred card, the wordmark up top. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <Link href="/" className="mb-8 font-heading text-lg font-bold tracking-tight">Fletcher</Link>
      <div className="surface w-full max-w-sm p-6">{children}</div>
    </main>
  );
}
