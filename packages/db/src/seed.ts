import { and, eq, isNull } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { addDaysISO, snapToWeekday, SYSTEM_TEMPLATES, todayISO, type MemberRole } from "@fletcher/core";
import { createDb } from "./client";
import { REPO_ROOT, requireEnv } from "./env";
import { createProjectWithTemplates } from "./services/project-factory";
import {
  activityLog,
  comments,
  commsMomentItems,
  commsMoments,
  commsPlans,
  deliverableVersions,
  deliverables,
  projects,
  tasks,
  templates,
  users,
  workspaceMembers,
  workspaces,
} from "./schema";

const { db, sql } = createDb();
const devEmail = requireEnv("DEV_USER_EMAIL");
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(REPO_ROOT, process.env.UPLOAD_DIR)
  : path.join(REPO_ROOT, ".uploads");

// 1. System templates (upsert by key)
for (const t of SYSTEM_TEMPLATES) {
  await db
    .insert(templates)
    .values({
      systemKey: t.key,
      workspaceId: null,
      kind: t.kind,
      projectType: t.projectType,
      name: t.name,
      description: t.description,
      isDefault: true,
      definition: t.definition,
    })
    .onConflictDoUpdate({
      target: templates.systemKey,
      set: { name: t.name, description: t.description, definition: t.definition, updatedAt: new Date() },
    });
}
console.log(`system templates: ${SYSTEM_TEMPLATES.length}`);

// 2. Demo workspace (skip if it already exists)
const existing = await db.query.workspaces.findFirst({ where: eq(workspaces.slug, "moriah") });
if (existing) {
  console.log("MŌRIAH workspace already exists, skipping demo data");
  await sql.end();
  process.exit(0);
}

const [workspace] = await db
  .insert(workspaces)
  .values({ slug: "moriah", name: "MŌRIAH", artistName: "MŌRIAH", timezone: "America/Chicago" })
  .returning();

const people: { email: string; name: string; role: MemberRole; permission?: "owner" | "admin" | "member" | "guest"; title?: string; company?: string; isExternal?: boolean }[] = [
  { email: devEmail, name: "You", role: "manager", permission: "owner", title: "Manager", company: "F2 Entertainment" },
  { email: "artist@fletcher.local", name: "MŌRIAH", role: "artist", permission: "admin" },
  { email: "melissa@fletcher.local", name: "Melissa F.", role: "marketing", title: "Client lead", company: "mtheory" },
  { email: "shaneel@fletcher.local", name: "Shaneel Y.", role: "marketing", title: "Marketing associate", company: "mtheory" },
  { email: "maria@fletcher.local", name: "Maria S.", role: "social", title: "Socials" },
  { email: "beau@fletcher.local", name: "Beau R.", role: "videographer", title: "Director / DP", isExternal: true },
  { email: "duncan@fletcher.local", name: "Duncan S.", role: "producer", isExternal: true },
  { email: "mix@fletcher.local", name: "Jordan M.", role: "mix_engineer", isExternal: true },
  { email: "master@fletcher.local", name: "Sam K.", role: "mastering_engineer", isExternal: true },
  { email: "antyon@fletcher.local", name: "Antyon D.", role: "label_distributor", company: "The Orchard", isExternal: true },
  { email: "pr@fletcher.local", name: "Casey L.", role: "publicist", isExternal: true },
];
const memberByRole: Record<string, string> = {};
for (const p of people) {
  const [u] = await db
    .insert(users)
    .values({ email: p.email, name: p.name })
    .onConflictDoUpdate({ target: users.email, set: { name: p.name } })
    .returning();
  const [m] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId: workspace!.id,
      userId: u!.id,
      role: p.role,
      permission: p.permission ?? "member",
      title: p.title,
      company: p.company,
      isExternal: p.isExternal ?? false,
    })
    .returning();
  memberByRole[p.role] ??= m!.id;
  if (p.email === devEmail) memberByRole.me = m!.id;
}

// 3. Projects
const today = todayISO();
const albumDate = snapToWeekday(addDaysISO(today, 120), "fri", "forward");
const album = await createProjectWithTemplates(db, {
  workspaceId: workspace!.id,
  type: "album",
  name: "Neon Honky Tonk",
  anchorDate: albumDate,
  color: "#4f46e5",
  releaseInfo: {
    label: "Independent",
    distributor: "The Orchard",
    genre: "Country",
    language: "English",
    tracklist: [
      { title: "Kick", isFocusTrack: false },
      { title: "On The Off Chance" },
      { title: "Womanipulation" },
      { title: "Problem With Loving You" },
      { title: "Neon Honky Tonk", isFocusTrack: true },
    ],
  },
});

const singleDate = snapToWeekday(addDaysISO(today, 35), "fri", "forward");
const single = await createProjectWithTemplates(db, {
  workspaceId: workspace!.id,
  type: "single",
  name: "Kick",
  anchorDate: singleDate,
  parentProjectId: album.id,
  color: "#d97706",
  releaseInfo: {
    upc: "885288322347",
    isrc: "QMDA72623399",
    genre: "Country",
    language: "English",
    presaveLink: "https://ffm.to/kick",
    retailLink: "https://ffm.to/kick",
    releaseTime: "00:00",
    releaseTimezone: "America/New_York",
    pitchQuote:
      "This one is for the girls. The women who stand out, stand up and show up every day. This song transcribes the moment my parents met: she was in a red dress, dancing, and he was mesmerized as the bass player in the house band.",
    spotifyPitchBlurb:
      "A Latin-country kick-off single: baritone storytelling verses, a hellfire jalapeño chorus and a half-time bridge. Produced in Nashville.",
    lyrics: "[Verse 1]\nHe caught her brown eyes 'cross that bar\nWith her boots scuffed up like scars\n\n[Chorus]\nShe's got a kick like a hellfire jalapeño on your lips...",
  },
});

const videoDate = singleDate;
const video = await createProjectWithTemplates(db, {
  workspaceId: workspace!.id,
  type: "music_video",
  name: "Kick — Official Music Video",
  anchorDate: videoDate,
  parentProjectId: single.id,
  color: "#dc2626",
});

// Mark some past tasks done / in progress so the dashboard looks alive
const singleTasks = await db.select().from(tasks).where(eq(tasks.projectId, single.id));
for (const t of singleTasks) {
  if (!t.dueDate) continue;
  const roleMember = t.roleKey ? memberByRole[t.roleKey] : undefined;
  const status = t.dueDate < addDaysISO(today, -7) ? "done" : t.dueDate < today ? (t.templateKey === "pitch_spotify" ? "in_progress" : "done") : "todo";
  await db.update(tasks).set({ status, assigneeMemberId: roleMember ?? null }).where(eq(tasks.id, t.id));
}
const videoTasks = await db.select().from(tasks).where(eq(tasks.projectId, video.id));
for (const t of videoTasks) {
  if (!t.dueDate) continue;
  const roleMember = t.roleKey ? memberByRole[t.roleKey] : undefined;
  const status = t.dueDate < today ? "done" : t.templateKey === "rough_cut" ? "in_review" : "todo";
  await db.update(tasks).set({ status, assigneeMemberId: roleMember ?? null }).where(eq(tasks.id, t.id));
}

// 4. Video deliverables with YouTube versions and time-coded comments
const YT = {
  roughCut: "oFNtBPoAnH4",
  fineCut: "Ze637YupIJE",
  officialVideo: "MhxkDI1wcLU",
  teaser: "85YOFUkqwMI",
};
const ytUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

const roughCutTask = videoTasks.find((t) => t.templateKey === "rough_cut");
const roughCut = roughCutTask?.deliverableId
  ? await db.query.deliverables.findFirst({ where: eq(deliverables.id, roughCutTask.deliverableId) })
  : null;
if (roughCut) {
  await db.update(deliverables).set({ status: "in_review", title: "Rough cut" }).where(eq(deliverables.id, roughCut.id));
  const [v1] = await db
    .insert(deliverableVersions)
    .values({ deliverableId: roughCut.id, versionNumber: 1, sourceType: "youtube", url: ytUrl(YT.roughCut), externalId: YT.roughCut, note: "First assembly. Color is untouched; temp mix.", uploadedByMemberId: memberByRole.videographer })
    .returning();
  const [c1] = await db
    .insert(comments)
    .values({ versionId: v1!.id, authorMemberId: memberByRole.artist, body: "Love the opening wide. Can we hold it a beat longer before the cut to the bar?", timestampSeconds: 4 })
    .returning();
  await db.insert(comments).values({ versionId: v1!.id, authorMemberId: memberByRole.videographer, body: "Yes, I have 2 more seconds of that take.", parentCommentId: c1!.id });
  await db.insert(comments).values({ versionId: v1!.id, authorMemberId: memberByRole.me, body: "Lip sync drifts here, the chorus lands late by a few frames.", timestampSeconds: 47 });
  await db.insert(comments).values({ versionId: v1!.id, authorMemberId: memberByRole.marketing, body: "This shot is the thumbnail. Grab a still.", timestampSeconds: 92 });
  await db.insert(comments).values({ versionId: v1!.id, authorMemberId: memberByRole.artist, body: "The reveal here is perfect.", timestampSeconds: 150, resolvedAt: new Date(), resolvedByMemberId: memberByRole.videographer });
  const [v2] = await db
    .insert(deliverableVersions)
    .values({ deliverableId: roughCut.id, versionNumber: 2, sourceType: "youtube", url: ytUrl(YT.fineCut), externalId: YT.fineCut, note: "Held the opening wide, fixed the chorus sync, first color pass.", uploadedByMemberId: memberByRole.videographer })
    .returning();
  await db.insert(comments).values({ versionId: v2!.id, authorMemberId: memberByRole.artist, body: "Sync is locked now. Color feels a touch warm on the bar interior.", timestampSeconds: 63 });
}

const officialVideoTask = singleTasks.find((t) => t.templateKey === "video_final");
if (officialVideoTask?.deliverableId) {
  await db.update(deliverables).set({ status: "in_review" }).where(eq(deliverables.id, officialVideoTask.deliverableId));
  await db.insert(deliverableVersions).values({ deliverableId: officialVideoTask.deliverableId, versionNumber: 1, sourceType: "youtube", url: ytUrl(YT.officialVideo), externalId: YT.officialVideo, note: "Lyric video draft while the OMV is in post.", uploadedByMemberId: memberByRole.videographer });
}
const teaserTask = singleTasks.find((t) => t.templateKey === "teaser_1");
if (teaserTask?.deliverableId) {
  await db.update(deliverables).set({ status: "approved" }).where(eq(deliverables.id, teaserTask.deliverableId));
  await db.insert(deliverableVersions).values({ deliverableId: teaserTask.deliverableId, versionNumber: 1, sourceType: "youtube", url: ytUrl(YT.teaser), externalId: YT.teaser, note: "15s vertical cut for Reels and TikTok.", uploadedByMemberId: memberByRole.social });
}

// 4b. Give the dev user and the socials member some open work so the Overview has something to show
const meTaskKeys = ["pitch_spotify", "presave_link", "crm_drafts", "warmup"];
for (const t of singleTasks) {
  if (t.templateKey && meTaskKeys.includes(t.templateKey)) await db.update(tasks).set({ assigneeMemberId: memberByRole.me }).where(eq(tasks.id, t.id));
}
const singlePlan = await db.query.commsPlans.findFirst({ where: eq(commsPlans.projectId, single.id) });
if (singlePlan) {
  const moments = await db.select().from(commsMoments).where(eq(commsMoments.planId, singlePlan.id));
  const byKey = new Map(moments.map((m) => [m.templateKey, m.id]));
  const assign = async (momentKey: string, platforms: string[], memberId: string | undefined) => {
    const momentId = byKey.get(momentKey);
    if (!momentId || !memberId) return;
    const items = await db.select().from(commsMomentItems).where(and(eq(commsMomentItems.momentId, momentId), isNull(commsMomentItems.parentItemId)));
    for (const it of items) if (platforms.includes(it.platform)) await db.update(commsMomentItems).set({ ownerMemberId: memberId }).where(eq(commsMomentItems.id, it.id));
  };
  await assign("announce", ["email", "sms"], memberByRole.me);
  await assign("teaser_2", ["instagram"], memberByRole.social);
  await assign("release_day", ["instagram", "tiktok"], memberByRole.social);
  await assign("release_night", ["spotify", "pandora"], memberByRole.marketing);
}

// 5. Profile Kit fixtures: one correct upload, one wrong-size upload
await fs.mkdir(path.join(uploadDir, "seed"), { recursive: true });
const okKey = "seed/profile-1000.png";
const badKey = "seed/profile-1200x600.png";
await sharp({ create: { width: 1000, height: 1000, channels: 3, background: "#1f2937" } }).png().toFile(path.join(uploadDir, okKey));
await sharp({ create: { width: 1200, height: 600, channels: 3, background: "#9ca3af" } }).png().toFile(path.join(uploadDir, badKey));
const okStat = await fs.stat(path.join(uploadDir, okKey));
const badStat = await fs.stat(path.join(uploadDir, badKey));

const [igSlot] = await db
  .insert(deliverables)
  .values({ workspaceId: workspace!.id, kind: "image", title: "Instagram profile image", specKey: "profile_instagram", assetScope: "workspace", status: "approved" })
  .returning();
await db.insert(deliverableVersions).values({ deliverableId: igSlot!.id, versionNumber: 1, sourceType: "upload", storageKey: okKey, fileName: "profile.png", mimeType: "image/png", bytes: okStat.size, width: 1000, height: 1000, uploadedByMemberId: memberByRole.me });
const [xSlot] = await db
  .insert(deliverables)
  .values({ workspaceId: workspace!.id, kind: "image", title: "X / Twitter profile image", specKey: "profile_x", assetScope: "workspace", status: "draft" })
  .returning();
await db.insert(deliverableVersions).values({ deliverableId: xSlot!.id, versionNumber: 1, sourceType: "upload", storageKey: badKey, fileName: "header-crop.png", mimeType: "image/png", bytes: badStat.size, width: 1200, height: 600, uploadedByMemberId: memberByRole.social });

// 6. Activity
await db.insert(activityLog).values([
  { workspaceId: workspace!.id, projectId: album.id, actorMemberId: memberByRole.me, type: "project.created", payload: { name: album.name } },
  { workspaceId: workspace!.id, projectId: single.id, actorMemberId: memberByRole.me, type: "project.created", payload: { name: single.name } },
  { workspaceId: workspace!.id, projectId: video.id, actorMemberId: memberByRole.videographer, type: "version.added", payload: { title: "Rough cut", version: 1 } },
  { workspaceId: workspace!.id, projectId: video.id, actorMemberId: memberByRole.artist, type: "comment.added", payload: { title: "Rough cut", timestamp: 4 } },
]);

const count = await db.select().from(projects);
console.log(`seeded workspace "${workspace!.slug}" with ${count.length} projects; log in as ${devEmail}`);
await sql.end();
