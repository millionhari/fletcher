import { and, eq } from "drizzle-orm";
import { userConnections } from "@fletcher/db";
import type { Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";
import { decryptSecret, encryptSecret } from "../crypto";

export type Provider = "google_drive" | "box";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scopes?: string[];
}

export interface ProviderClient {
  provider: Provider;
  label: string;
  buildAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  /** Who this is, for the Connections page. */
  whoAmI(accessToken: string): Promise<{ id: string; label: string }>;
  revoke(accessToken: string, refreshToken: string | null): Promise<void>;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `${name} is not configured` });
  return v;
}

async function tokenPost(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: String(json.error_description ?? json.error ?? `Token request failed (${res.status})`) });
  return json;
}

/** drive.file only: the picker grants access to exactly the files the person chooses. No restricted-scope review. */
export const google: ProviderClient = {
  provider: "google_drive",
  label: "Google Drive",
  buildAuthUrl: (state, redirectUri) =>
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: env("GOOGLE_OAUTH_CLIENT_ID"), redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/drive.file openid email", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state })}`,
  exchangeCode: async (code, redirectUri) => {
    const j = await tokenPost("https://oauth2.googleapis.com/token", { code, client_id: env("GOOGLE_OAUTH_CLIENT_ID"), client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"), redirect_uri: redirectUri, grant_type: "authorization_code" });
    return { accessToken: String(j.access_token), refreshToken: (j.refresh_token as string) ?? null, expiresIn: Number(j.expires_in ?? 3600), scopes: String(j.scope ?? "").split(" ").filter(Boolean) };
  },
  refresh: async (refreshToken) => {
    const j = await tokenPost("https://oauth2.googleapis.com/token", { refresh_token: refreshToken, client_id: env("GOOGLE_OAUTH_CLIENT_ID"), client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"), grant_type: "refresh_token" });
    return { accessToken: String(j.access_token), refreshToken, expiresIn: Number(j.expires_in ?? 3600) };
  },
  whoAmI: async (accessToken) => {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
    const j = (await res.json()) as { sub?: string; email?: string; name?: string };
    return { id: j.sub ?? "", label: j.email ?? j.name ?? "Google account" };
  },
  revoke: async (accessToken, refreshToken) => {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken ?? accessToken)}`, { method: "POST" }).catch(() => undefined);
  },
};

/** Box refresh tokens rotate on every use and expire after 60 days unused; `refresh` always returns the new one. */
export const box: ProviderClient = {
  provider: "box",
  label: "Box",
  buildAuthUrl: (state, redirectUri) => `https://account.box.com/api/oauth2/authorize?${new URLSearchParams({ client_id: env("BOX_CLIENT_ID"), redirect_uri: redirectUri, response_type: "code", state })}`,
  exchangeCode: async (code, redirectUri) => {
    const j = await tokenPost("https://api.box.com/oauth2/token", { grant_type: "authorization_code", code, client_id: env("BOX_CLIENT_ID"), client_secret: env("BOX_CLIENT_SECRET"), redirect_uri: redirectUri });
    return { accessToken: String(j.access_token), refreshToken: String(j.refresh_token), expiresIn: Number(j.expires_in ?? 3600) };
  },
  refresh: async (refreshToken) => {
    const j = await tokenPost("https://api.box.com/oauth2/token", { grant_type: "refresh_token", refresh_token: refreshToken, client_id: env("BOX_CLIENT_ID"), client_secret: env("BOX_CLIENT_SECRET") });
    return { accessToken: String(j.access_token), refreshToken: String(j.refresh_token), expiresIn: Number(j.expires_in ?? 3600) };
  },
  whoAmI: async (accessToken) => {
    const res = await fetch("https://api.box.com/2.0/users/me", { headers: { authorization: `Bearer ${accessToken}` } });
    const j = (await res.json()) as { id?: string; login?: string; name?: string };
    return { id: j.id ?? "", label: j.login ?? j.name ?? "Box account" };
  },
  revoke: async (accessToken) => {
    await fetch("https://api.box.com/oauth2/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env("BOX_CLIENT_ID"), client_secret: env("BOX_CLIENT_SECRET"), token: accessToken }) }).catch(() => undefined);
  },
};

export const PROVIDERS: Record<Provider, ProviderClient> = { google_drive: google, box };

export function providerConfigured(provider: Provider): boolean {
  return provider === "google_drive" ? !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) : !!(process.env.BOX_CLIENT_ID && process.env.BOX_CLIENT_SECRET);
}

export async function saveConnection(db: Db, userId: string, provider: Provider, tokens: TokenSet, account: { id: string; label: string }) {
  const expiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null;
  const values = {
    userId,
    provider,
    providerAccountId: account.id,
    accountLabel: account.label,
    accessTokenEnc: encryptSecret(tokens.accessToken),
    accessTokenExpiresAt: expiresAt,
    refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
    scopes: tokens.scopes ?? [],
    updatedAt: new Date(),
  };
  await db.insert(userConnections).values(values).onConflictDoUpdate({ target: [userConnections.userId, userConnections.provider], set: values });
}

/**
 * A usable access token for this person's provider, refreshing when it has
 * under two minutes left. Rotated refresh tokens (Box) are persisted at once.
 */
export async function getValidAccessToken(db: Db, userId: string, provider: Provider): Promise<string> {
  const row = await db.query.userConnections.findFirst({ where: and(eq(userConnections.userId, userId), eq(userConnections.provider, provider)) });
  if (!row) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Connect ${PROVIDERS[provider].label} first` });
  const fresh = row.accessTokenExpiresAt ? row.accessTokenExpiresAt.getTime() - Date.now() > 2 * 60 * 1000 : true;
  if (fresh) return decryptSecret(row.accessTokenEnc);
  if (!row.refreshTokenEnc) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Your ${PROVIDERS[provider].label} connection expired — connect it again` });
  const next = await PROVIDERS[provider].refresh(decryptSecret(row.refreshTokenEnc));
  await db
    .update(userConnections)
    .set({ accessTokenEnc: encryptSecret(next.accessToken), accessTokenExpiresAt: next.expiresIn ? new Date(Date.now() + next.expiresIn * 1000) : null, refreshTokenEnc: next.refreshToken ? encryptSecret(next.refreshToken) : row.refreshTokenEnc, updatedAt: new Date() })
    .where(eq(userConnections.id, row.id));
  return next.accessToken;
}

export async function disconnect(db: Db, userId: string, provider: Provider): Promise<void> {
  const row = await db.query.userConnections.findFirst({ where: and(eq(userConnections.userId, userId), eq(userConnections.provider, provider)) });
  if (!row) return;
  try {
    await PROVIDERS[provider].revoke(decryptSecret(row.accessTokenEnc), row.refreshTokenEnc ? decryptSecret(row.refreshTokenEnc) : null);
  } catch {}
  await db.delete(userConnections).where(eq(userConnections.id, row.id));
}
