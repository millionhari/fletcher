import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  DELIVERABLE_KINDS,
  DELIVERABLE_STATUSES,
  MEMBER_ROLES,
  MOMENT_STATUSES,
  PERMISSIONS,
  PLATFORMS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  TASK_STATUSES,
  TEMPLATE_KINDS,
  VERSION_SOURCES,
} from "@fletcher/core";

export const memberRoleEnum = pgEnum("member_role", MEMBER_ROLES);
export const permissionEnum = pgEnum("permission", PERMISSIONS);
export const projectTypeEnum = pgEnum("project_type", PROJECT_TYPES);
export const projectStatusEnum = pgEnum("project_status", PROJECT_STATUSES);
export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);
export const deliverableKindEnum = pgEnum("deliverable_kind", DELIVERABLE_KINDS);
export const deliverableStatusEnum = pgEnum("deliverable_status", DELIVERABLE_STATUSES);
export const versionSourceEnum = pgEnum("version_source", VERSION_SOURCES);
export const templateKindEnum = pgEnum("template_kind", TEMPLATE_KINDS);
export const platformEnum = pgEnum("platform", PLATFORMS);
export const momentStatusEnum = pgEnum("moment_status", MOMENT_STATUSES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  ...timestamps,
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  artistName: text("artist_name").notNull(),
  timezone: text("timezone").notNull().default("America/Chicago"),
  plan: text("plan").notNull().default("free"),
  ...timestamps,
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("other"),
    permission: permissionEnum("permission").notNull().default("member"),
    title: text("title"),
    company: text("company"),
    isExternal: boolean("is_external").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("workspace_members_unique").on(t.workspaceId, t.userId)],
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    systemKey: text("system_key"),
    kind: templateKindEnum("kind").notNull(),
    projectType: projectTypeEnum("project_type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    definition: jsonb("definition").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("templates_system_key").on(t.systemKey),
    index("templates_workspace_idx").on(t.workspaceId, t.kind, t.projectType),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    parentProjectId: uuid("parent_project_id"),
    type: projectTypeEnum("type").notNull(),
    name: text("name").notNull(),
    status: projectStatusEnum("status").notNull().default("planning"),
    anchorDate: date("anchor_date").notNull(),
    anchorLabel: text("anchor_label").notNull().default("Release date"),
    timelineTemplateId: uuid("timeline_template_id").references(() => templates.id, { onDelete: "set null" }),
    commsTemplateId: uuid("comms_template_id").references(() => templates.id, { onDelete: "set null" }),
    enabledOptions: text("enabled_options").array().notNull().default(sql`'{}'::text[]`),
    releaseInfo: jsonb("release_info").notNull().default({}),
    color: text("color").notNull().default("#6366f1"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("projects_workspace_idx").on(t.workspaceId, t.status)],
);

export const deliverables = pgTable(
  "deliverables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    kind: deliverableKindEnum("kind").notNull(),
    title: text("title").notNull(),
    specKey: text("spec_key"),
    /** workspace | prerelease | release — which asset set a spec slot belongs to. */
    assetScope: text("asset_scope"),
    status: deliverableStatusEnum("status").notNull().default("draft"),
    description: text("description"),
    ...timestamps,
  },
  (t) => [index("deliverables_project_idx").on(t.projectId), index("deliverables_workspace_idx").on(t.workspaceId)],
);

export const deliverableVersions = pgTable(
  "deliverable_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliverableId: uuid("deliverable_id").notNull().references(() => deliverables.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    sourceType: versionSourceEnum("source_type").notNull(),
    url: text("url"),
    externalId: text("external_id"),
    storageKey: text("storage_key"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    bytes: integer("bytes"),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: real("duration_seconds"),
    note: text("note"),
    uploadedByMemberId: uuid("uploader_id").references(() => workspaceMembers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("deliverable_versions_unique").on(t.deliverableId, t.versionNumber)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    templateKey: text("template_key"),
    title: text("title").notNull(),
    description: text("description"),
    phase: text("phase").notNull().default("general"),
    roleKey: memberRoleEnum("role_key"),
    assigneeMemberId: uuid("assignee_member_id").references(() => workspaceMembers.id, { onDelete: "set null" }),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    isDateOverridden: boolean("is_date_overridden").notNull().default(false),
    status: taskStatusEnum("status").notNull().default("todo"),
    dependsOn: text("depends_on").array().notNull().default(sql`'{}'::text[]`),
    deliverableId: uuid("deliverable_id").references(() => deliverables.id, { onDelete: "set null" }),
    milestone: jsonb("milestone"),
    childProjectId: uuid("child_project_id").references(() => projects.id, { onDelete: "set null" }),
    parentTaskId: uuid("parent_task_id"),
    doc: jsonb("doc"),
    docText: text("doc_text"),
    docUpdatedAt: timestamp("doc_updated_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("tasks_project_idx").on(t.projectId, t.dueDate), index("tasks_assignee_idx").on(t.assigneeMemberId)],
);

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("task_checklist_task_idx").on(t.taskId, t.sortOrder)],
);

export const attachmentKindEnum = pgEnum("attachment_kind", ["deliverable", "link", "file"]);

export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    kind: attachmentKindEnum("kind").notNull(),
    deliverableId: uuid("deliverable_id").references(() => deliverables.id, { onDelete: "cascade" }),
    url: text("url"),
    title: text("title"),
    storageKey: text("storage_key"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    bytes: integer("bytes"),
    addedByMemberId: uuid("added_by_member_id").references(() => workspaceMembers.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_attachments_task_idx").on(t.taskId, t.sortOrder)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id").references(() => deliverableVersions.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    authorMemberId: uuid("author_member_id").references(() => workspaceMembers.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    timestampSeconds: real("timestamp_seconds"),
    /** Region pin for document review — see commentAnchorSchema in @fletcher/core. */
    anchor: jsonb("anchor"),
    parentCommentId: uuid("parent_comment_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByMemberId: uuid("resolved_by_member_id").references(() => workspaceMembers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("comments_version_idx").on(t.versionId),
    index("comments_task_idx").on(t.taskId),
    check("comments_one_target", sql`(${t.versionId} is not null) <> (${t.taskId} is not null)`),
  ],
);

export const commsPlans = pgTable("comms_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  name: text("name").notNull(),
  notes: text("notes"),
  ...timestamps,
});

export const commsMoments = pgTable(
  "comms_moments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id").notNull().references(() => commsPlans.id, { onDelete: "cascade" }),
    templateKey: text("template_key"),
    title: text("title").notNull(),
    scheduledDate: date("scheduled_date"),
    scheduledTime: text("scheduled_time"),
    timezone: text("timezone"),
    cta: text("cta"),
    copy: text("copy"),
    link: text("link"),
    assetDeliverableId: uuid("asset_deliverable_id").references(() => deliverables.id, { onDelete: "set null" }),
    assetNote: text("asset_note"),
    status: momentStatusEnum("status").notNull().default("planned"),
    /** Standing checklist (not dated) vs a dated rollout moment. */
    isChecklist: boolean("is_checklist").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("comms_moments_plan_idx").on(t.planId, t.sortOrder)],
);

export const commsMomentItems = pgTable(
  "comms_moment_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    momentId: uuid("moment_id").notNull().references(() => commsMoments.id, { onDelete: "cascade" }),
    parentItemId: uuid("parent_item_id"),
    platform: platformEnum("platform").notNull().default("other"),
    title: text("title").notNull(),
    ownerMemberId: uuid("owner_member_id").references(() => workspaceMembers.id, { onDelete: "set null" }),
    isDone: boolean("is_done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("comms_moment_items_moment_idx").on(t.momentId, t.sortOrder)],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    actorMemberId: uuid("actor_member_id").references(() => workspaceMembers.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_workspace_idx").on(t.workspaceId, t.createdAt), index("activity_task_idx").on(t.taskId, t.createdAt)],
);

// Relations (for db.query.* convenience)
export const usersRelations = relations(users, ({ many }) => ({ memberships: many(workspaceMembers) }));
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
}));
export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));
export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  parent: one(projects, { fields: [projects.parentProjectId], references: [projects.id], relationName: "children" }),
  children: many(projects, { relationName: "children" }),
  tasks: many(tasks),
  deliverables: many(deliverables),
  commsPlan: one(commsPlans, { fields: [projects.id], references: [commsPlans.projectId] }),
  timelineTemplate: one(templates, { fields: [projects.timelineTemplateId], references: [templates.id] }),
}));
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  assignee: one(workspaceMembers, { fields: [tasks.assigneeMemberId], references: [workspaceMembers.id] }),
  deliverable: one(deliverables, { fields: [tasks.deliverableId], references: [deliverables.id] }),
  checklist: many(taskChecklistItems),
  attachments: many(taskAttachments),
}));
export const taskChecklistItemsRelations = relations(taskChecklistItems, ({ one }) => ({
  task: one(tasks, { fields: [taskChecklistItems.taskId], references: [tasks.id] }),
}));
export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, { fields: [taskAttachments.taskId], references: [tasks.id] }),
  deliverable: one(deliverables, { fields: [taskAttachments.deliverableId], references: [deliverables.id] }),
  addedBy: one(workspaceMembers, { fields: [taskAttachments.addedByMemberId], references: [workspaceMembers.id] }),
}));
export const deliverablesRelations = relations(deliverables, ({ one, many }) => ({
  project: one(projects, { fields: [deliverables.projectId], references: [projects.id] }),
  versions: many(deliverableVersions),
}));
export const deliverableVersionsRelations = relations(deliverableVersions, ({ one, many }) => ({
  deliverable: one(deliverables, { fields: [deliverableVersions.deliverableId], references: [deliverables.id] }),
  uploadedBy: one(workspaceMembers, { fields: [deliverableVersions.uploadedByMemberId], references: [workspaceMembers.id] }),
  comments: many(comments),
}));
export const commentsRelations = relations(comments, ({ one }) => ({
  version: one(deliverableVersions, { fields: [comments.versionId], references: [deliverableVersions.id] }),
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(workspaceMembers, { fields: [comments.authorMemberId], references: [workspaceMembers.id] }),
}));
export const commsPlansRelations = relations(commsPlans, ({ one, many }) => ({
  project: one(projects, { fields: [commsPlans.projectId], references: [projects.id] }),
  moments: many(commsMoments),
}));
export const commsMomentsRelations = relations(commsMoments, ({ one, many }) => ({
  plan: one(commsPlans, { fields: [commsMoments.planId], references: [commsPlans.id] }),
  items: many(commsMomentItems),
  asset: one(deliverables, { fields: [commsMoments.assetDeliverableId], references: [deliverables.id] }),
}));
export const commsMomentItemsRelations = relations(commsMomentItems, ({ one }) => ({
  moment: one(commsMoments, { fields: [commsMomentItems.momentId], references: [commsMoments.id] }),
  owner: one(workspaceMembers, { fields: [commsMomentItems.ownerMemberId], references: [workspaceMembers.id] }),
}));
export const activityLogRelations = relations(activityLog, ({ one }) => ({
  actor: one(workspaceMembers, { fields: [activityLog.actorMemberId], references: [workspaceMembers.id] }),
  project: one(projects, { fields: [activityLog.projectId], references: [projects.id] }),
}));
