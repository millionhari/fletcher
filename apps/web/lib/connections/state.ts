import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * OAuth `state`: a random nonce signed with the connections key, carried in a
 * short-lived cookie and echoed by the provider. Ties the callback to the
 * browser that started it.
 */
const COOKIE = "fl_oauth_state";

function secret(): string {
  return process.env.CONNECTIONS_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev";
}

export function makeState(returnTo: string): { state: string; cookie: { name: string; value: string; maxAge: number } } {
  const nonce = randomBytes(16).toString("hex");
  const payload = Buffer.from(JSON.stringify({ n: nonce, r: returnTo })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  const state = `${payload}.${sig}`;
  return { state, cookie: { name: COOKIE, value: state, maxAge: 600 } };
}

export function verifyState(fromQuery: string | null, fromCookie: string | undefined): { returnTo: string } | null {
  if (!fromQuery || !fromCookie || fromQuery !== fromCookie) return null;
  const [payload, sig] = fromQuery.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const { r } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { r: string };
    return { returnTo: typeof r === "string" && r.startsWith("/") ? r : "/account/connections" };
  } catch {
    return null;
  }
}

export const STATE_COOKIE = COOKIE;
