/** Supabase is optional in local dev (see AUTH_DEV_BYPASS); every client checks this first. */
export function supabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/** Only ever true outside production: skip Supabase and act as DEV_USER_EMAIL. */
export function devBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "1";
}
