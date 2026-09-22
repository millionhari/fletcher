import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for the things only the server may do: sending
 * invites, looking up auth users. Never reaches the browser. Lazily built so
 * local dev with `AUTH_DEV_BYPASS` doesn't need Supabase configured at all.
 */
let admin: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export function supabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Email an invite that lands on `redirectTo` with a session, or tell the
 * caller the person already has an account (they can just sign in; membership
 * attaches by email).
 */
export async function inviteByEmail(email: string, redirectTo: string, data?: Record<string, unknown>): Promise<"sent" | "already_registered"> {
  const { error } = await client().auth.admin.inviteUserByEmail(email, { redirectTo, data });
  if (!error) return "sent";
  // Supabase reports an existing account with a 422 whose message mentions registration.
  if (error.status === 422 || /already/i.test(error.message)) return "already_registered";
  throw error;
}
