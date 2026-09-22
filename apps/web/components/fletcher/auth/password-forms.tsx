"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supabase) return <p className="text-sm text-muted-foreground">Sign-in isn&apos;t configured in this environment.</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/set-password")}` });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  if (sent) return <div><h1 className="text-lg font-semibold">Check your email</h1><p className="mt-1 text-sm text-muted-foreground">If <span className="font-medium text-foreground">{email}</span> has an account, a reset link is on its way.</p></div>;
  return (
    <div>
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">We&apos;ll email you a link to choose a new one.</p>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Send reset link</Button>
      </form>
      <p className="mt-5 text-center text-xs text-muted-foreground"><Link href="/login" className="font-medium text-foreground hover:underline">Back to sign in</Link></p>
    </div>
  );
}

/** Lands here from an invite or reset link, already holding a session. */
export function SetPasswordForm() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const invited = params.get("invite") === "1";
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supabase) return <p className="text-sm text-muted-foreground">Sign-in isn&apos;t configured in this environment.</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password, ...(invited && name.trim() ? { data: { full_name: name.trim() } } : {}) });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.replace(next);
    router.refresh();
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">{invited ? "You're in" : "Choose a new password"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{invited ? "Set a password to finish joining the workspace. You can also sign in with Google next time." : "Pick something you haven't used here before."}</p>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        {invited && <div className="grid gap-1.5"><Label htmlFor="name">Your name</Label><Input id="name" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam Lee" /></div>}
        <div className="grid gap-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" required minLength={8} autoFocus={!invited} value={password} onChange={(e) => setPassword(e.target.value)} /><p className="text-2xs text-muted-foreground">At least 8 characters.</p></div>
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{invited ? "Join workspace" : "Save password"}</Button>
      </form>
    </div>
  );
}
