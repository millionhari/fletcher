CREATE TYPE "public"."file_origin" AS ENUM('upload', 'seed', 'google_drive', 'dropbox', 'box', 'share_link');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'importing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "workspace_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" real,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"origin" "file_origin" DEFAULT 'upload' NOT NULL,
	"origin_url" text,
	"uploaded_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	CONSTRAINT "workspace_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ALTER COLUMN "bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "task_attachments" ALTER COLUMN "bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN "file_id" uuid;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD COLUMN "file_id" uuid;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "custom_quota_gb" integer;--> statement-breakpoint
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_uploaded_by_member_id_workspace_members_id_fk" FOREIGN KEY ("uploaded_by_member_id") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_files_ws_status_idx" ON "workspace_files" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_files_ws_created_idx" ON "workspace_files" USING btree ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_file_id_workspace_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."workspace_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_file_id_workspace_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."workspace_files"("id") ON DELETE set null ON UPDATE no action;