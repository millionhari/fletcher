import { eq, sql } from "drizzle-orm";
import { createDb, users, workspaceMembers, workspaces, type Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * What the web layer knows about the signed-in person, taken from the Supabase
 * session. Built outside this package so it stays free of Next and Supabase
 * imports; `null` means no session.
 */
export interface AuthUser {
  authId: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

let cached: { db: Db } | null = null;
export function getDb(): Db {
  if (!cached) cached = { db: createDb().db };
  return cached.db;
}

/**
 * Resolve the app user for a session. Three cases, in order:
 *  1. already linked by auth id (the normal path);
 *  2. a `users` row with the same email but no auth id — seeded or invited
 *     members — which gets linked now;
 *  3. nobody knows this email yet: create the row.
 * Everything downstream keys on `users.id`, so a person keeps their comments,
 * assignments and memberships across sign-in methods.
 */
export async function getCurrentUser(db: Db, auth: AuthUser): Promise<CurrentUser> {
  const email = auth.email.toLowerCase();
  const byAuth = await db.query.users.findFirst({ where: eq(users.authId, auth.authId) });
  if (byAuth) return pick(byAuth);

  const byEmail = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` });
  if (byEmail) {
    const [linked] = await db
      .update(users)
      .set({ authId: auth.authId, avatarUrl: byEmail.avatarUrl ?? auth.avatarUrl ?? null, updatedAt: new Date() })
      .where(eq(users.id, byEmail.id))
      .returning();
    return pick(linked!);
  }

  const [created] = await db
    .insert(users)
    .values({ email, name: auth.name?.trim() || email.split("@")[0]!, avatarUrl: auth.avatarUrl ?? null, authId: auth.authId })
    .returning();
  return pick(created!);
}

function pick(u: typeof users.$inferSelect): CurrentUser {
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl };
}

export interface Context {
  db: Db;
  /** Null when there is no session. `authedProcedure` narrows it. */
  user: CurrentUser | null;
  /** Schedule work to run after the response is sent (imports, emails). Falls back to running inline. */
  enqueue: (fn: () => Promise<void>) => void;
}

export interface CreateContextOptions {
  auth: AuthUser | null;
  enqueue?: (fn: () => Promise<void>) => void;
}

export async function createContext(opts: CreateContextOptions): Promise<Context> {
  const db = getDb();
  const user = opts.auth ? await getCurrentUser(db, opts.auth) : null;
  const enqueue = opts.enqueue ?? ((fn) => { void fn().catch((e) => console.error("background task failed", e)); });
  return { db, user, enqueue };
}

/** Resolve a workspace by slug and assert the current user is a member. */
export async function requireMembership(ctx: Context, workspaceSlugOrId: string) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const userId = ctx.user.id;
  const workspace =
    (await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.slug, workspaceSlugOrId) })) ??
    (isUuid(workspaceSlugOrId)
      ? await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceSlugOrId) })
      : undefined);
  if (!workspace) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
  const member = await ctx.db.query.workspaceMembers.findFirst({
    where: (m, { and, eq }) => and(eq(m.workspaceId, workspace.id), eq(m.userId, userId)),
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
  return { workspace, member };
}

/** Owners and admins manage people and plan; everyone else works inside the workspace. */
export function requirePermission(member: { permission: string }, allowed: readonly string[]): void {
  if (!allowed.includes(member.permission)) throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to do that" });
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export { workspaceMembers };
