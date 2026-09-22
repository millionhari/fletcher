import "server-only";
import { cache } from "react";
import type { AuthUser } from "@fletcher/api";
import { createSupabaseServer } from "@/lib/supabase/server";
import { devBypass } from "@/lib/supabase/env";

/**
 * The signed-in person for this request, or null. Cached per request so the
 * layout and every tRPC call in the same render share one lookup. Verifies
 * the JWT locally (getClaims) rather than round-tripping to Supabase.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  if (devBypass()) {
    const email = process.env.DEV_USER_EMAIL ?? "dev@fletcher.local";
    // A fixed placeholder id; a real sign-in with the same email later overwrites it (see getCurrentUser).
    return { authId: "00000000-0000-4000-8000-000000000001", email, name: null };
  }
  const supabase = await createSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub || !c.email) return null;
  const meta = (c.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  return { authId: c.sub, email: c.email, name: meta.full_name ?? meta.name ?? null, avatarUrl: meta.avatar_url ?? meta.picture ?? null };
});
