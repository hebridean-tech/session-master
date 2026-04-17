CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"object_type" varchar(50),
	"object_id" varchar(255),
	"summary" text NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"job_type" varchar(100) NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"input_refs_json" jsonb,
	"output_text" text,
	"output_json" jsonb,
	"reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"provider_type" varchar(50) NOT NULL,
	"endpoint_url" varchar(1000),
	"model_name" varchar(255),
	"api_key_ref" varchar(255),
	"permission_level" integer DEFAULT 0 NOT NULL,
	"run_mode" varchar(50) DEFAULT 'manual' NOT NULL,
	"max_run_frequency" varchar(50),
	"enabled_actions_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_table_id_unique" UNIQUE("table_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_file_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_file_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"edited_by_user_id" uuid,
	"edited_by_ai" boolean DEFAULT false NOT NULL,
	"change_summary" text,
	"content_markdown" text NOT NULL,
	"source_refs_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"path" varchar(1000) NOT NULL,
	"title" varchar(255) NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_currency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_sheet_id" uuid NOT NULL,
	"cp" integer DEFAULT 0 NOT NULL,
	"sp" integer DEFAULT 0 NOT NULL,
	"ep" integer DEFAULT 0 NOT NULL,
	"gp" integer DEFAULT 0 NOT NULL,
	"pp" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_currency_character_sheet_id_unique" UNIQUE("character_sheet_id")
);
--> statement-breakpoint
CREATE TABLE "character_sheet_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_sheet_id" uuid NOT NULL,
	"locked_by_request_id" varchar(255),
	"locked_by_user_id" uuid,
	"reason" text,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlocked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "character_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"character_name" varchar(255) NOT NULL,
	"character_class" varchar(100) NOT NULL,
	"subclass" varchar(100),
	"level" integer DEFAULT 1 NOT NULL,
	"ancestry_or_species" varchar(100) NOT NULL,
	"background" varchar(100),
	"alignment" varchar(50),
	"proficiency_bonus" integer DEFAULT 2 NOT NULL,
	"ability_scores_json" jsonb NOT NULL,
	"skill_proficiencies_json" jsonb NOT NULL,
	"tool_proficiencies_json" jsonb NOT NULL,
	"languages_json" jsonb NOT NULL,
	"ac" integer,
	"hp_current" integer,
	"hp_max" integer,
	"speed" integer,
	"xp" integer DEFAULT 0 NOT NULL,
	"xp_to_next_level" integer,
	"condition_active_json" jsonb,
	"spellcasting_info_json" jsonb,
	"dm_notes" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_spells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_sheet_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"school" varchar(50),
	"prepared" boolean DEFAULT false NOT NULL,
	"source" varchar(50) DEFAULT 'class_feature' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dice_rolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"roll_type" varchar(100) NOT NULL,
	"dice_expression" varchar(255) NOT NULL,
	"modifier_json" jsonb,
	"result_json" jsonb NOT NULL,
	"visible_to_players" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downtime_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"assigned_dm_user_id" uuid,
	"category" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"rules_reference" text,
	"requested_time_days" integer,
	"approved_time_days" integer,
	"gold_cost_requested" integer,
	"gold_cost_approved" integer,
	"outcome_summary" text,
	"dm_ruling" text,
	"visibility" varchar(20) DEFAULT 'table' NOT NULL,
	"submitted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downtime_time_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"in_world_days_available" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"summary" text,
	"metadata_json" jsonb,
	"confidence" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_change_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"character_sheet_id" uuid NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" varchar(255),
	"suggested_by_user_id" uuid,
	"generated_by_ai" boolean DEFAULT false NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"item_name" varchar(255),
	"normalized_item_key" varchar(255),
	"quantity_delta" integer,
	"currency_delta_json" jsonb,
	"item_type" varchar(50),
	"rationale" text,
	"confidence" numeric,
	"duplicate_check_status" varchar(50),
	"review_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_sheet_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"item_type" varchar(50) NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"attuned" boolean DEFAULT false NOT NULL,
	"weight" numeric,
	"rarity" varchar(50),
	"is_quest_item" boolean DEFAULT false NOT NULL,
	"magic" boolean DEFAULT false NOT NULL,
	"description" text,
	"dm_notes" text,
	"source_type" varchar(50) DEFAULT 'manual' NOT NULL,
	"source_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_dm_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_time_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"time_window_id" uuid NOT NULL,
	"days_allocated" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"session_label" varchar(255),
	"session_date" date,
	"visibility" varchar(20) DEFAULT 'table' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spell_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_sheet_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"current" integer NOT NULL,
	"max" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'player' NOT NULL,
	"status" varchar(20) DEFAULT 'invited' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"system_name" varchar(100) DEFAULT 'D&D 5e' NOT NULL,
	"edition" varchar(50) DEFAULT '2024' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"timezone" varchar(50),
	"campaign_date_label" varchar(255),
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"password_hash" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_file_revisions" ADD CONSTRAINT "campaign_file_revisions_campaign_file_id_campaign_files_id_fk" FOREIGN KEY ("campaign_file_id") REFERENCES "public"."campaign_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_file_revisions" ADD CONSTRAINT "campaign_file_revisions_edited_by_user_id_users_id_fk" FOREIGN KEY ("edited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_files" ADD CONSTRAINT "campaign_files_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_files" ADD CONSTRAINT "campaign_files_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_currency" ADD CONSTRAINT "character_currency_character_sheet_id_character_sheets_id_fk" FOREIGN KEY ("character_sheet_id") REFERENCES "public"."character_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sheet_locks" ADD CONSTRAINT "character_sheet_locks_character_sheet_id_character_sheets_id_fk" FOREIGN KEY ("character_sheet_id") REFERENCES "public"."character_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sheet_locks" ADD CONSTRAINT "character_sheet_locks_locked_by_user_id_users_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sheets" ADD CONSTRAINT "character_sheets_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sheets" ADD CONSTRAINT "character_sheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_spells" ADD CONSTRAINT "character_spells_character_sheet_id_character_sheets_id_fk" FOREIGN KEY ("character_sheet_id") REFERENCES "public"."character_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dice_rolls" ADD CONSTRAINT "dice_rolls_request_id_downtime_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."downtime_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dice_rolls" ADD CONSTRAINT "dice_rolls_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_requests" ADD CONSTRAINT "downtime_requests_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_requests" ADD CONSTRAINT "downtime_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_requests" ADD CONSTRAINT "downtime_requests_assigned_dm_user_id_users_id_fk" FOREIGN KEY ("assigned_dm_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_time_windows" ADD CONSTRAINT "downtime_time_windows_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_entities" ADD CONSTRAINT "extracted_entities_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_change_suggestions" ADD CONSTRAINT "inventory_change_suggestions_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_change_suggestions" ADD CONSTRAINT "inventory_change_suggestions_character_sheet_id_character_sheets_id_fk" FOREIGN KEY ("character_sheet_id") REFERENCES "public"."character_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_change_suggestions" ADD CONSTRAINT "inventory_change_suggestions_suggested_by_user_id_users_id_fk" FOREIGN KEY ("suggested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_change_suggestions" ADD CONSTRAINT "inventory_change_suggestions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_character_sheet_id_character_sheets_id_fk" FOREIGN KEY ("character_sheet_id") REFERENCES "public"."character_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_files" ADD CONSTRAINT "note_files_note_id_session_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."session_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_request_id_downtime_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."downtime_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_time_allocations" ADD CONSTRAINT "request_time_allocations_request_id_downtime_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."downtime_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_time_allocations" ADD CONSTRAINT "request_time_allocations_time_window_id_downtime_time_windows_id_fk" FOREIGN KEY ("time_window_id") REFERENCES "public"."downtime_time_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spell_slots" ADD CONSTRAINT "spell_slots_character_sheet_id_character_sheets_id_fk" FOREIGN KEY ("character_sheet_id") REFERENCES "public"."character_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_members" ADD CONSTRAINT "table_members_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_members" ADD CONSTRAINT "table_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;