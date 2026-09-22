"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; blurb: string; cta: string; switchText: string; switchCta: string; switchHref: string }> = {
  login: { title: "Welcome back", blurb: "Sign in to your workspaces.", cta: "Sign in", switchText: "New to Fletcher?", switchCta: "Create an account", switchHref: "/signup" },
  signup: { title: "Create your account", blurb: "Plan releases, review cuts, and run the rollout with your team.", cta: "Create account", switchText: "Already have an account?", switchCta: "Sign in", switchHref: "/login" },
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3c-1.7 3.4-1.7 7.4 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

/** Email + password sign in / sign up, plus Google. `next` in the URL is honoured after sign in. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const copy = COPY[mode];
  const supabase = createSupabaseBrowser();
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  if (!supabase) {
    return <p className="text-sm text-muted-foreground">Sign-in isn&apos;t configured in this environment. Set <code className="font-mono text-xs">AUTH_DEV_BYPASS=1</code> for local development.</p>;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("password");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() || undefined }, emailRedirectTo: callback() } });
        if (error) throw error;
        // With email confirmation on, there's no session yet — tell them to check their inbox.
        if (data.session) { router.replace(next); router.refresh(); } else setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy("google");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) { setError(error.message); setBusy(null); }
  };

  if (sent) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it to finish creating your account.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">{copy.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{copy.blurb}</p>

      <Button type="button" variant="outline" className="mt-5 w-full" disabled={busy !== null} onClick={google}>
        {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleMark />}Continue with Google
      </Button>
      <div className="my-4 flex items-center gap-3 text-2xs uppercase tracking-wider text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>

      <form onSubmit={submit} className="grid gap-3">
        {mode === "signup" && (
          <div className="grid gap-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam Lee" />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required autoFocus={mode === "login"} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "login" && <Link href="/forgot-password" className="text-2xs text-muted-foreground hover:text-foreground">Forgot password?</Link>}
          </div>
          <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "signup" && <p className="text-2xs text-muted-foreground">At least 8 characters.</p>}
        </div>
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
        <Button type="submit" className="mt-1 w-full" disabled={busy !== null}>{busy === "password" && <Loader2 className="animate-spin" />}{copy.cta}</Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">{copy.switchText} <Link href={`${copy.switchHref}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground hover:underline">{copy.switchCta}</Link></p>
    </div>
  );
}
