import { eq } from "drizzle-orm";
import { createDb, users, workspaceMembers, workspaces, type Db } from "@fletcher/db";
import { TRPCError } from "@trpc/server";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

let cached: { db: Db } | null = null;
export function getDb(): Db {
  if (!cached) cached = { db: createDb().db };
  return cached.db;
}

/**
 * Dev auth stub. Returns the user whose email is DEV_USER_EMAIL.
 * When Supabase auth lands, this reads the session instead; nothing else changes.
 */
export async function getCurrentUser(db: Db): Promise<CurrentUser> {
  const email = process.env.DEV_USER_EMAIL ?? "dev@fletcher.local";
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: `No user with email ${email}. Run pnpm db:seed.` });
  }
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
}

export interface Context {
  db: Db;
  user: CurrentUser;
}

export async function createContext(): Promise<Context> {
  const db = getDb();
  const user = await getCurrentUser(db);
  return { db, user };
}

/** Resolve a workspace by slug and assert the current user is a member. */
export async function requireMembership(ctx: Context, workspaceSlugOrId: string) {
  const workspace =
    (await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.slug, workspaceSlugOrId) })) ??
    (isUuid(workspaceSlugOrId)
      ? await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceSlugOrId) })
      : undefined);
  if (!workspace) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
  const member = await ctx.db.query.workspaceMembers.findFirst({
    where: (m, { and, eq }) => and(eq(m.workspaceId, workspace.id), eq(m.userId, ctx.user.id)),
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
  return { workspace, member };
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export { workspaceMembers };
