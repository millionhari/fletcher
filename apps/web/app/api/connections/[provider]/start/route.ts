import { NextResponse, type NextRequest } from "next/server";
import { PROVIDERS, providerConfigured, type Provider } from "@fletcher/api/connections";
import { getAuthUser } from "@/lib/auth/session";
import { makeState } from "@/lib/connections/state";

export const runtime = "nodejs";

/** Kick off the provider's consent screen. `return` is where to land afterwards. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/connections/[provider]/start">) {
  const { provider } = await ctx.params;
  if (!(provider in PROVIDERS)) return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  if (!(await getAuthUser())) return NextResponse.redirect(new URL("/login", req.url));
  if (!providerConfigured(provider as Provider)) return NextResponse.redirect(new URL("/account/connections?error=not_configured", req.url));

  const returnTo = req.nextUrl.searchParams.get("return") ?? "/account/connections";
  const { state, cookie } = makeState(returnTo.startsWith("/") ? returnTo : "/account/connections");
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/connections/${provider}/callback`;
  const res = NextResponse.redirect(PROVIDERS[provider as Provider].buildAuthUrl(state, redirectUri));
  res.cookies.set(cookie.name, cookie.value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: cookie.maxAge, path: "/api/connections" });
  return res;
}
