import { NextResponse, type NextRequest } from "next/server";
import { createContext } from "@fletcher/api";
import { PROVIDERS, saveConnection, type Provider } from "@fletcher/api/connections";
import { getAuthUser } from "@/lib/auth/session";
import { STATE_COOKIE, verifyState } from "@/lib/connections/state";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/connections/[provider]/callback">) {
  const { provider } = await ctx.params;
  const back = (q: string) => NextResponse.redirect(new URL(`/account/connections?${q}`, req.url));
  if (!(provider in PROVIDERS)) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const verified = verifyState(req.nextUrl.searchParams.get("state"), req.cookies.get(STATE_COOKIE)?.value);
  if (!verified) return back("error=state");
  const code = req.nextUrl.searchParams.get("code");
  const denied = req.nextUrl.searchParams.get("error");
  if (denied || !code) return back(`error=${encodeURIComponent(denied ?? "no_code")}`);

  const auth = await getAuthUser();
  if (!auth) return NextResponse.redirect(new URL("/login", req.url));
  const { db, user } = await createContext({ auth });
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const client = PROVIDERS[provider as Provider];
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/connections/${provider}/callback`;
    const tokens = await client.exchangeCode(code, redirectUri);
    const who = await client.whoAmI(tokens.accessToken);
    await saveConnection(db, user.id, provider as Provider, tokens, who);
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`);
  }
  const res = NextResponse.redirect(new URL(verified.returnTo, req.url));
  res.cookies.delete(STATE_COOKIE);
  res.headers.append("set-cookie", `${STATE_COOKIE}=; Path=/api/connections; Max-Age=0`);
  return res;
}
