"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "./env";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client (publishable key only). Null when Supabase isn't configured. */
export function createSupabaseBrowser() {
  const env = supabasePublicEnv();
  if (!env) return null;
  if (!cached) cached = createBrowserClient(env.url, env.key);
  return cached;
}
