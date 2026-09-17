CREATE TYPE "public"."deliverable_kind" AS ENUM('video', 'image', 'audio', 'document', 'link');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('draft', 'in_review', 'changes_requested', 'approved');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('artist', 'manager', 'marketing', 'social', 'videographer', 'photographer', 'producer', 'mix_engineer', 'mastering_engineer', 'label_distributor', 'publicist', 'booking_agent', 'business_manager', 'publisher_sync', 'legal', 'merch', 'web', 'other');--> statement-breakpoint
CREATE TYPE "public"."moment_status" AS ENUM('planned', 'ready', 'posted', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('owner', 'admin', 'member', 'guest');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('instagram', 'tiktok', 'facebook', 'x', 'threads', 'youtube', 'youtube_music', 'spotify', 'apple_music', 'amazon_music', 'pandora', 'soundcloud', 'tidal', 'deezer', 'bandsintown', 'songkick', 'link_in_bio', 'website', 'email', 'sms', 'webstore', 'other');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'released', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('single', 'album', 'ep', 'music_video', 'tour', 'campaign', 'custom');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'in_review', 'blocked', 'done');--> statement-breakpoint
CREATE TYPE "public"."template_kind" AS ENUM('timeline', 'comms');--> statement-breakpoint
CREATE TYPE "public"."version_source" AS ENUM('youtube', 'vimeo', 'upload', 'url');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"actor_member_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"author_member_id" uuid,
	"body" text NOT NULL,
	"timestamp_seconds" real,
	"parent_comment_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolved_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comms_moment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moment_id" uuid NOT NULL,
	"parent_item_id" uuid,
	"platform" "platform" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"owner_member_id" uuid,
	"is_done" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comms_moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"template_key" text,
	"title" text NOT NULL,
	"scheduled_date" date,
	"scheduled_time" text,
	"timezone" text,
	"cta" text,
	"copy" text,
	"link" text,
	"asset_deliverable_id" uuid,
	"asset_note" text,
	"status" "moment_status" DEFAULT 'planned' NOT NULL,
	"is_checklist" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comms_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comms_plans_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "deliverable_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"source_type" "version_source" NOT NULL,
	"url" text,
	"external_id" text,
	"storage_key" text,
	"file_name" text,
	"mime_type" text,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"duration_seconds" real,
	"note" text,
	"uploader_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"kind" "deliverable_kind" NOT NULL,
	"title" text NOT NULL,
	"spec_key" text,
	"asset_scope" text,
	"status" "deliverable_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_project_id" uuid,
	"type" "project_type" NOT NULL,
	"name" text NOT NULL,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"anchor_date" date NOT NULL,
	"anchor_label" text DEFAULT 'Release date' NOT NULL,
	"timeline_template_id" uuid,
	"comms_template_id" uuid,
	"enabled_options" text[] DEFAULT '{}'::text[] NOT NULL,
	"release_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"template_key" text,
	"title" text NOT NULL,
	"description" text,
	"phase" text DEFAULT 'general' NOT NULL,
	"role_key" "member_role",
	"assignee_member_id" uuid,
	"start_date" date,
	"due_date" date,
	"is_date_overridden" boolean DEFAULT false NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"depends_on" text[] DEFAULT '{}'::text[] NOT NULL,
	"deliverable_id" uuid,
	"milestone" jsonb,
	"child_project_id" uuid,
	"parent_task_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"system_key" text,
	"kind" "template_kind" NOT NULL,
	"project_type" "project_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'other' NOT NULL,
	"permission" "permission" DEFAULT 'member' NOT NULL,
	"title" text,
	"company" text,
	"is_external" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"artist_name" text NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_member_id_workspace_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_version_id_deliverable_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deliverable_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_member_id_workspace_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_resolved_by_member_id_workspace_members_id_fk" FOREIGN KEY ("resolved_by_member_id") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comms_moment_items" ADD CONSTRAINT "comms_moment_items_moment_id_comms_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."comms_moments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comms_moment_items" ADD CONSTRAINT "comms_moment_items_owner_member_id_workspace_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comms_moments" ADD CONSTRAINT "comms_moments_plan_id_comms_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."comms_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comms_moments" ADD CONSTRAINT "comms_moments_asset_deliverable_id_deliverables_id_fk" FOREIGN KEY ("asset_deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comms_plans" ADD CONSTRAINT "comms_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_uploader_id_workspace_members_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_timeline_template_id_templates_id_fk" FOREIGN KEY ("timeline_template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_comms_template_id_templates_id_fk" FOREIGN KEY ("comms_template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_member_id_workspace_members_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_child_project_id_projects_id_fk" FOREIGN KEY ("child_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_workspace_idx" ON "activity_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_version_idx" ON "comments" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "comms_moment_items_moment_idx" ON "comms_moment_items" USING btree ("moment_id","sort_order");--> statement-breakpoint
CREATE INDEX "comms_moments_plan_idx" ON "comms_moments" USING btree ("plan_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "deliverable_versions_unique" ON "deliverable_versions" USING btree ("deliverable_id","version_number");--> statement-breakpoint
CREATE INDEX "deliverables_project_idx" ON "deliverables" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deliverables_workspace_idx" ON "deliverables" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_idx" ON "projects" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id","due_date");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_system_key" ON "templates" USING btree ("system_key");--> statement-breakpoint
CREATE INDEX "templates_workspace_idx" ON "templates" USING btree ("workspace_id","kind","project_type");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_unique" ON "workspace_members" USING btree ("workspace_id","user_id");