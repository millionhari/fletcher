import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { devBypass, supabasePublicEnv } from "./env";

const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/auth/", "/api/"];

/**
 * Refresh the session cookie on every request and bounce signed-out visitors
 * from app pages to /login. This is an optimistic gate only — tRPC does the
 * real authorization — so it reads claims locally and never hits the network
 * beyond the cookie refresh.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = supabasePublicEnv();
  if (devBypass() || !env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p));

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path !== "/" ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }
  if (signedIn && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
