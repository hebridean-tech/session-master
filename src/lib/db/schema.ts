import { pgTable, uuid, varchar, text, boolean, integer, numeric, jsonb, timestamp, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Better Auth tables ──
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// ── Tables (game tables) ──
export const tables = pgTable('tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  systemName: varchar('system_name', { length: 100 }).notNull().default("D&D 5e"),
  edition: varchar('edition', { length: 50 }).notNull().default("2024"),
  ownerUserId: text('owner_user_id').notNull().references(() => user.id),
  timezone: varchar('timezone', { length: 50 }),
  inviteCode: varchar('invite_code', { length: 8 }).unique(),
  campaignDateLabel: varchar('campaign_date_label', { length: 255 }),
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  currentLevel: integer('current_level').default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Table Members ──
export const tableMembers = pgTable('table_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  userId: text('user_id').notNull().references(() => user.id),
  role: varchar('role', { length: 20 }).notNull().default('player'),
  status: varchar('status', { length: 20 }).notNull().default('invited'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Downtime Requests ──
export const downtimeRequests = pgTable('downtime_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  createdByUserId: text('created_by_user_id').notNull().references(() => user.id),
  assignedDmUserId: text('assigned_dm_user_id').references(() => user.id),
  category: varchar('category', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  rulesReference: text('rules_reference'),
  requestedTimeDays: integer('requested_time_days'),
  approvedTimeDays: integer('approved_time_days'),
  characterSheetId: uuid('character_sheet_id').references(() => characterSheets.id),
  materialsJson: jsonb('materials_json'),
  goldCostRequested: integer('gold_cost_requested'),
  goldCostApproved: integer('gold_cost_approved'),
  outcomeSummary: text('outcome_summary'),
  dmRuling: text('dm_ruling'),
  visibility: varchar('visibility', { length: 20 }).notNull().default('table'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Request Comments ──
export const requestComments = pgTable('request_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => downtimeRequests.id),
  authorUserId: text('author_user_id').notNull().references(() => user.id),
  body: text('body').notNull(),
  isDmOnly: boolean('is_dm_only').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Dice Rolls ──
export const diceRolls = pgTable('dice_rolls', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').references(() => tables.id),
  requestId: uuid('request_id').references(() => downtimeRequests.id),
  createdByUserId: text('created_by_user_id').notNull().references(() => user.id),
  rollType: varchar('roll_type', { length: 100 }).notNull(),
  diceExpression: varchar('dice_expression', { length: 255 }).notNull(),
  modifierJson: jsonb('modifier_json'),
  resultJson: jsonb('result_json').notNull(),
  visibleToPlayers: boolean('visible_to_players').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Downtime Time Windows ──
export const downtimeTimeWindows = pgTable('downtime_time_windows', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  label: varchar('label', { length: 255 }).notNull(),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  inWorldDaysAvailable: integer('in_world_days_available'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Request Time Allocations ──
export const requestTimeAllocations = pgTable('request_time_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => downtimeRequests.id),
  timeWindowId: uuid('time_window_id').notNull().references(() => downtimeTimeWindows.id),
  daysAllocated: integer('days_allocated').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Character Sheets ──
export const characterSheets = pgTable('character_sheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  userId: text('user_id').notNull().references(() => user.id),
  characterName: varchar('character_name', { length: 255 }).notNull(),
  characterClass: varchar('character_class', { length: 100 }).notNull(),
  subclass: varchar('subclass', { length: 100 }),
  level: integer('level').notNull().default(1),
  ancestryOrSpecies: varchar('ancestry_or_species', { length: 100 }).notNull(),
  background: varchar('background', { length: 100 }),
  alignment: varchar('alignment', { length: 50 }),
  proficiencyBonus: integer('proficiency_bonus').notNull().default(2),
  abilityScoresJson: jsonb('ability_scores_json').notNull(),
  skillProficienciesJson: jsonb('skill_proficiencies_json').notNull(),
  toolProficienciesJson: jsonb('tool_proficiencies_json').notNull(),
  languagesJson: jsonb('languages_json').notNull(),
  ac: integer('ac'),
  hpCurrent: integer('hp_current'),
  hpMax: integer('hp_max'),
  speed: integer('speed'),
  xp: integer('xp').notNull().default(0),
  xpToNextLevel: integer('xp_to_next_level'),
  conditionActiveJson: jsonb('condition_active_json'),
  spellcastingInfoJson: jsonb('spellcasting_info_json'),
  dmNotes: text('dm_notes'),
  isLocked: boolean('is_locked').notNull().default(false),
  notes: text('notes'),
  personalityTraits: text('personality_traits'),
  ideals: text('ideals'),
  bonds: text('bonds'),
  flaws: text('flaws'),
  backstory: text('backstory'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Inventory Items ──
export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterSheetId: uuid('character_sheet_id').notNull().references(() => characterSheets.id),
  name: varchar('name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  itemType: varchar('item_type', { length: 50 }).notNull(),
  equipped: boolean('equipped').notNull().default(false),
  attuned: boolean('attuned').notNull().default(false),
  weight: numeric('weight'),
  rarity: varchar('rarity', { length: 50 }),
  isQuestItem: boolean('is_quest_item').notNull().default(false),
  magic: boolean('magic').notNull().default(false),
  description: text('description'),
  dmNotes: text('dm_notes'),
  sourceType: varchar('source_type', { length: 50 }).notNull().default('manual'),
  sourceId: varchar('source_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Character Currency ──
export const characterCurrency = pgTable('character_currency', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterSheetId: uuid('character_sheet_id').notNull().unique().references(() => characterSheets.id),
  cp: integer('cp').notNull().default(0),
  sp: integer('sp').notNull().default(0),
  ep: integer('ep').notNull().default(0),
  gp: integer('gp').notNull().default(0),
  pp: integer('pp').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Character Spells ──
export const characterSpells = pgTable('character_spells', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterSheetId: uuid('character_sheet_id').notNull().references(() => characterSheets.id),
  name: varchar('name', { length: 255 }).notNull(),
  level: integer('level').notNull().default(0),
  school: varchar('school', { length: 50 }),
  prepared: boolean('prepared').notNull().default(false),
  source: varchar('source', { length: 50 }).notNull().default('class_feature'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Spell Slots ──
export const spellSlots = pgTable('spell_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterSheetId: uuid('character_sheet_id').notNull().references(() => characterSheets.id),
  level: integer('level').notNull(),
  current: integer('current').notNull(),
  max: integer('max').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Character Sheet Locks ──
export const characterSheetLocks = pgTable('character_sheet_locks', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterSheetId: uuid('character_sheet_id').notNull().references(() => characterSheets.id),
  lockedByRequestId: varchar('locked_by_request_id', { length: 255 }),
  lockedByUserId: text('locked_by_user_id').references(() => user.id),
  reason: text('reason'),
  lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
});

// ── Session Notes ──
export const sessionNotes = pgTable('session_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  authorUserId: text('author_user_id').notNull().references(() => user.id),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sessionLabel: varchar('session_label', { length: 255 }),
  sessionDate: date('session_date'),
  visibility: varchar('visibility', { length: 20 }).notNull().default('table'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Note Files ──
export const noteFiles = pgTable('note_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').notNull().references(() => sessionNotes.id),
  storagePath: varchar('storage_path', { length: 1000 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Extracted Entities ──
export const extractedEntities = pgTable('extracted_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sourceId: varchar('source_id', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  summary: text('summary'),
  metadataJson: jsonb('metadata_json'),
  confidence: numeric('confidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── AI Settings ──
export const aiSettings = pgTable('ai_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().unique().references(() => tables.id),
  providerType: varchar('provider_type', { length: 50 }).notNull(),
  endpointUrl: varchar('endpoint_url', { length: 1000 }),
  modelName: varchar('model_name', { length: 255 }),
  apiKeyRef: varchar('api_key_ref', { length: 255 }),
  permissionLevel: integer('permission_level').notNull().default(0),
  runMode: varchar('run_mode', { length: 50 }).notNull().default('manual'),
  maxRunFrequency: varchar('max_run_frequency', { length: 50 }),
  enabledActionsJson: jsonb('enabled_actions_json'),
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  hostedProvider: varchar('hosted_provider', { length: 50 }),
  frequency: varchar('frequency', { length: 50 }).default('normal'),
  previewBeforeSave: boolean('preview_before_save').notNull().default(true),
  aiInventorySuggestions: boolean('ai_inventory_suggestions').notNull().default(true),
  onNoteUpload: boolean('on_note_upload').notNull().default(false),
  onRequestSubmit: boolean('on_request_submit').notNull().default(false),
  onRequestResolve: boolean('on_request_resolve').notNull().default(false),
  dailyDigestTime: varchar('daily_digest_time', { length: 10 }).default('08:00'),
  weeklySummaryDay: varchar('weekly_summary_day', { length: 20 }).default('monday'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Campaign Files ──
export const campaignFiles = pgTable('campaign_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  path: varchar('path', { length: 1000 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  currentRevision: integer('current_revision').notNull().default(1),
  createdByUserId: text('created_by_user_id').notNull().references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Campaign File Revisions ──
export const campaignFileRevisions = pgTable('campaign_file_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignFileId: uuid('campaign_file_id').notNull().references(() => campaignFiles.id),
  revisionNumber: integer('revision_number').notNull(),
  editedByUserId: text('edited_by_user_id').references(() => user.id),
  editedByAi: boolean('edited_by_ai').notNull().default(false),
  changeSummary: text('change_summary'),
  contentMarkdown: text('content_markdown').notNull(),
  sourceRefsJson: jsonb('source_refs_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── AI Jobs ──
export const aiJobs = pgTable('ai_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  requestedByUserId: text('requested_by_user_id').notNull().references(() => user.id),
  jobType: varchar('job_type', { length: 100 }).notNull(),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  inputRefsJson: jsonb('input_refs_json'),
  outputText: text('output_text'),
  outputJson: jsonb('output_json'),
  reviewedByUserId: text('reviewed_by_user_id').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ── Inventory Change Suggestions ──
export const inventoryChangeSuggestions = pgTable('inventory_change_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  characterSheetId: uuid('character_sheet_id').notNull().references(() => characterSheets.id),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sourceId: varchar('source_id', { length: 255 }),
  suggestedByUserId: text('suggested_by_user_id').references(() => user.id),
  generatedByAi: boolean('generated_by_ai').notNull().default(false),
  changeType: varchar('change_type', { length: 50 }).notNull(),
  itemName: varchar('item_name', { length: 255 }),
  normalizedItemKey: varchar('normalized_item_key', { length: 255 }),
  quantityDelta: integer('quantity_delta'),
  currencyDeltaJson: jsonb('currency_delta_json'),
  itemType: varchar('item_type', { length: 50 }),
  rationale: text('rationale'),
  confidence: numeric('confidence'),
  duplicateCheckStatus: varchar('duplicate_check_status', { length: 50 }),
  reviewStatus: varchar('review_status', { length: 20 }).notNull().default('pending'),
  reviewedByUserId: text('reviewed_by_user_id').references(() => user.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── DM Plans ──
export const dmPlans = pgTable('dm_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  authorUserId: text('author_user_id').notNull().references(() => user.id),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull().default(''),
  sessionLabel: varchar('session_label', { length: 255 }),
  tags: text('tags').array().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Activity Log ──
export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  actorUserId: text('actor_user_id').references(() => user.id),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  objectType: varchar('object_type', { length: 50 }),
  objectId: varchar('object_id', { length: 255 }),
  summary: text('summary').notNull(),
  metadataJson: jsonb('metadata_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Loot Entries ──
export const lootEntries = pgTable('loot_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 20 }).notNull().default('loot'),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  itemType: varchar('item_type', { length: 100 }).notNull().default('wondrous'),
  rarity: varchar('rarity', { length: 20 }).notNull().default('common'),
  quantity: integer('quantity').notNull().default(1),
  valueGp: numeric('value_gp', { precision: 12, scale: 2 }).default('0'),
  description: text('description'),
  isHomebrew: boolean('is_homebrew').notNull().default(false),
  sourceRef: varchar('source_ref', { length: 255 }),
  awardedToCharacterId: uuid('awarded_to_character_id').references(() => characterSheets.id, { onDelete: 'set null' }),
  createdByUserId: text('created_by_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
