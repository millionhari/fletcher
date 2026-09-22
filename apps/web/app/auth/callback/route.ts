import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "magiclink", "email", "email_change"];

/**
 * Where every sign-in link lands. Two shapes arrive here:
 *  - OAuth (Google): `?code=` → exchanged for a session.
 *  - Email links (invite, confirm, reset): `?token_hash=&type=` → verified.
 *    This needs the Supabase email templates to link to
 *    `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type={{ .Type }}&next=…`
 *    (see .env.example notes).
 * Invite and recovery then go to the password screen; the workspace they were
 * invited to rides along in `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const rawNext = searchParams.get("next") ?? "/";
  // Only ever redirect within the app.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const fail = (msg: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  const supabase = await createSupabaseServer();
  if (!supabase) return fail("Sign-in is not configured");

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.message);
  } else {
    return fail("That link is missing or has expired");
  }

  if (type === "invite") return NextResponse.redirect(`${origin}/set-password?invite=1&next=${encodeURIComponent(next)}`);
  if (type === "recovery") return NextResponse.redirect(`${origin}/set-password?next=${encodeURIComponent(next)}`);
  return NextResponse.redirect(`${origin}${next}`);
}
