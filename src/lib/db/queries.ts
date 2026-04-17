import { db } from '$lib/db';
import { tables, tableMembers, user, characterSheets, downtimeRequests, requestComments, diceRolls, downtimeTimeWindows, requestTimeAllocations, activityLog, sessionNotes, noteFiles, aiSettings, aiJobs, extractedEntities, inventoryItems, inventoryChangeSuggestions, characterCurrency, characterSpells, spellSlots, dmPlans, lootEntries, session, account, verification } from './schema';
import { eq, and, desc, sum, sql, like, gte, lte, count as countFn } from 'drizzle-orm';
import crypto from 'crypto';

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function createTable(data: {
  name: string;
  description?: string;
  systemName?: string;
  edition?: string;
  timezone?: string;
  ownerUserId: string;
}) {
  const inviteCode = generateInviteCode();
  const [table] = await db
    .insert(tables)
    .values({
      name: data.name,
      description: data.description || null,
      systemName: data.systemName || 'D&D 5e',
      edition: data.edition || '2024',
      timezone: data.timezone || null,
      ownerUserId: data.ownerUserId,
      inviteCode,
    })
    .returning();

  await db
    .insert(tableMembers)
    .values({
      tableId: table.id,
      userId: data.ownerUserId,
      role: 'dm',
      status: 'active',
    });

  return table;
}

export async function getTablesByUser(userId: string) {
  return db
    .select({ table: tables, member: tableMembers })
    .from(tableMembers)
    .innerJoin(tables, eq(tableMembers.tableId, tables.id))
    .where(eq(tableMembers.userId, userId));
}

export async function joinTableByCode(userId: string, code: string) {
  const [table] = await db
    .select()
    .from(tables)
    .where(eq(tables.inviteCode, code))
    .limit(1);

  if (!table) return null;

  const [member] = await db
    .insert(tableMembers)
    .values({
      tableId: table.id,
      userId,
      role: 'player',
      status: 'active',
    })
    .returning();

  return { table, member };
}

export async function getTableMembers(tableId: string) {
  return db
    .select({ member: tableMembers, user: user })
    .from(tableMembers)
    .innerJoin(user, eq(tableMembers.userId, user.id))
    .where(eq(tableMembers.tableId, tableId));
}

export async function getTableById(tableId: string) {
  const [table] = await db
    .select()
    .from(tables)
    .where(eq(tables.id, tableId))
    .limit(1);
  return table;
}

export async function getUserTableRole(userId: string, tableId: string) {
  const [member] = await db
    .select()
    .from(tableMembers)
    .where(and(eq(tableMembers.userId, userId), eq(tableMembers.tableId, tableId)))
    .limit(1);
  return member;
}

// ── Character Sheets ──
export async function createCharacterSheet(data: {
  tableId: string;
  userId: string;
  characterName: string;
  characterClass: string;
  subclass?: string;
  level?: number;
  ancestryOrSpecies: string;
  background?: string;
  alignment?: string;
  ac?: number;
  hpMax?: number;
  hpCurrent?: number;
  speed?: number;
  proficiencyBonus?: number;
  xp?: number;
  abilityScoresJson?: Record<string, number>;
  skillProficienciesJson?: string[];
  toolProficienciesJson?: string[];
  languagesJson?: string[];
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  backstory?: string;
}) {
  const [sheet] = await db
    .insert(characterSheets)
    .values({
      ...data,
      level: data.level ?? 1,
      subclass: data.subclass || null,
      background: data.background || null,
      alignment: data.alignment || null,
      ac: data.ac ?? null,
      hpMax: data.hpMax ?? null,
      hpCurrent: data.hpCurrent ?? null,
      speed: data.speed ?? null,
      proficiencyBonus: data.proficiencyBonus ?? 2,
      xp: data.xp ?? 0,
      abilityScoresJson: data.abilityScoresJson || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      skillProficienciesJson: data.skillProficienciesJson || [],
      toolProficienciesJson: data.toolProficienciesJson || [],
      languagesJson: data.languagesJson || [],
      personalityTraits: data.personalityTraits || null,
      ideals: data.ideals || null,
      bonds: data.bonds || null,
      flaws: data.flaws || null,
      backstory: data.backstory || null,
    })
    .returning();
  return sheet;
}

export async function getCharacterSheetsByTable(tableId: string) {
  return db
    .select({ sheet: characterSheets, user: user })
    .from(characterSheets)
    .innerJoin(user, eq(characterSheets.userId, user.id))
    .where(eq(characterSheets.tableId, tableId));
}

export async function getCharacterSheetById(id: string) {
  const [sheet] = await db
    .select({ sheet: characterSheets, user: user })
    .from(characterSheets)
    .innerJoin(user, eq(characterSheets.userId, user.id))
    .where(eq(characterSheets.id, id))
    .limit(1);
  return sheet;
}

export async function getCharacterSheetsByUser(userId: string, tableId: string) {
  return db
    .select()
    .from(characterSheets)
    .where(and(eq(characterSheets.userId, userId), eq(characterSheets.tableId, tableId)));
}

export async function updateCharacterSheet(id: string, data: Record<string, unknown>) {
  const [updated] = await db
    .update(characterSheets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(characterSheets.id, id))
    .returning();
  return updated;
}

export async function deleteCharacterSheet(id: string) {
  // Delete related rows first (FK constraints have no CASCADE)
  try { await db.delete(inventoryItems).where(eq(inventoryItems.characterSheetId, id)); } catch {}
  try { await db.delete(characterSpells).where(eq(characterSpells.characterSheetId, id)); } catch {}
  try { await db.delete(spellSlots).where(eq(spellSlots.characterSheetId, id)); } catch {}
  try { await db.delete(characterCurrency).where(eq(characterCurrency.characterSheetId, id)); } catch {}
  try { await db.delete(downtimeRequests).where(eq(downtimeRequests.characterSheetId, id)); } catch {}
  try { await db.delete(inventoryChangeSuggestions).where(eq(inventoryChangeSuggestions.characterSheetId, id)); } catch {}
  await db.delete(characterSheets).where(eq(characterSheets.id, id));
}

// ── Downtime Requests ──
export async function createDowntimeRequest(data: {
  tableId: string;
  createdByUserId: string;
  characterSheetId?: string;
  category: string;
  title: string;
  description: string;
  status?: string;
  rulesReference?: string;
  requestedTimeDays?: number;
  goldCostRequested?: number;
  materialsJson?: unknown;
}) {
  const values = {
    ...data,
    characterSheetId: data.characterSheetId || null,
    status: data.status || 'draft',
    rulesReference: data.rulesReference || null,
    requestedTimeDays: data.requestedTimeDays || null,
    goldCostRequested: data.goldCostRequested || null,
    materialsJson: data.materialsJson || null,
    submittedAt: data.status === 'submitted' ? new Date() : null,
  };
  const [req] = await db.insert(downtimeRequests).values(values as any).returning();
  return req;
}

export async function getRequestsByTable(tableId: string, status?: string) {
  const conditions = [eq(downtimeRequests.tableId, tableId)];
  if (status && status !== 'all') conditions.push(eq(downtimeRequests.status, status));
  return db
    .select({ request: downtimeRequests, user: user, sheet: characterSheets })
    .from(downtimeRequests)
    .innerJoin(user, eq(downtimeRequests.createdByUserId, user.id))
    .leftJoin(characterSheets, eq(downtimeRequests.characterSheetId, characterSheets.id))
    .where(and(...conditions))
    .orderBy(desc(downtimeRequests.createdAt));
}

export async function getRequestById(id: string) {
  const [row] = await db
    .select({ request: downtimeRequests, user: user, sheet: characterSheets })
    .from(downtimeRequests)
    .innerJoin(user, eq(downtimeRequests.createdByUserId, user.id))
    .leftJoin(characterSheets, eq(downtimeRequests.characterSheetId, characterSheets.id))
    .where(eq(downtimeRequests.id, id))
    .limit(1);
  return row;
}

export async function updateRequest(id: string, data: Record<string, unknown>) {
  const [updated] = await db
    .update(downtimeRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(downtimeRequests.id, id))
    .returning();
  return updated;
}

// ── Comments ──
export async function createComment(data: {
  requestId: string;
  authorUserId: string;
  body: string;
  isDmOnly?: boolean;
}) {
  const [comment] = await db
    .insert(requestComments)
    .values({
      requestId: data.requestId,
      authorUserId: data.authorUserId,
      body: data.body,
      isDmOnly: data.isDmOnly ?? false,
    })
    .returning();
  return comment;
}

export async function getCommentsByRequest(requestId: string) {
  return db
    .select({ comment: requestComments, user: user })
    .from(requestComments)
    .innerJoin(user, eq(requestComments.authorUserId, user.id))
    .where(eq(requestComments.requestId, requestId))
    .orderBy(requestComments.createdAt);
}

// ── Activity Log ──
export async function createActivityLog(data: {
  tableId: string;
  actorUserId?: string;
  eventType: string;
  objectType?: string;
  objectId?: string;
  summary: string;
  metadataJson?: unknown;
}) {
  const [entry] = await db
    .insert(activityLog)
    .values({
      tableId: data.tableId,
      actorUserId: data.actorUserId || null,
      eventType: data.eventType,
      objectType: data.objectType || null,
      objectId: data.objectId || null,
      summary: data.summary,
      metadataJson: data.metadataJson || null,
    })
    .returning();
  return entry;
}

export async function getActivityLogByTable(tableId: string, opts?: { actorUserId?: string; eventType?: string; dateFrom?: string; dateTo?: string; page?: number; perPage?: number }) {
  const page = opts?.page || 1;
  const perPage = opts?.perPage || 25;
  const conditions = [eq(activityLog.tableId, tableId)];
  if (opts?.actorUserId) conditions.push(eq(activityLog.actorUserId, opts.actorUserId));
  if (opts?.eventType) conditions.push(eq(activityLog.eventType, opts.eventType));
  if (opts?.dateFrom) conditions.push(gte(activityLog.createdAt, new Date(opts.dateFrom)));
  if (opts?.dateTo) conditions.push(lte(activityLog.createdAt, new Date(opts.dateTo)));
  return db
    .select({ log: activityLog, user: user })
    .from(activityLog)
    .leftJoin(user, eq(activityLog.actorUserId, user.id))
    .where(and(...conditions))
    .orderBy(desc(activityLog.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
}

export async function countActivityLogByTable(tableId: string, opts?: { actorUserId?: string; eventType?: string; dateFrom?: string; dateTo?: string }) {
  const conditions = [eq(activityLog.tableId, tableId)];
  if (opts?.actorUserId) conditions.push(eq(activityLog.actorUserId, opts.actorUserId));
  if (opts?.eventType) conditions.push(eq(activityLog.eventType, opts.eventType));
  if (opts?.dateFrom) conditions.push(gte(activityLog.createdAt, new Date(opts.dateFrom)));
  if (opts?.dateTo) conditions.push(lte(activityLog.createdAt, new Date(opts.dateTo)));
  const rows = await db.select({ total: countFn() }).from(activityLog).where(and(...conditions));
  return rows[0]?.total || 0;
}

// ── Session Notes ──
export async function createSessionNote(data: {
  tableId: string;
  authorUserId: string;
  title: string;
  body: string;
  sourceType: string;
  sessionLabel?: string;
  sessionDate?: Date | null;
  visibility?: string;
}) {
  const [note] = await db.insert(sessionNotes).values({
    ...data,
    sessionLabel: data.sessionLabel || null,
    sessionDate: data.sessionDate ? new Date(data.sessionDate).toISOString() : null,
    visibility: data.visibility || 'table',
  }).returning();
  return note;
}

export async function getSessionNotesByTable(tableId: string, userId?: string, userRole?: string) {
  const conditions = [eq(sessionNotes.tableId, tableId)];
  // DM-only notes hidden from players (handled at query level for simplicity)
  const rows = await db
    .select({ note: sessionNotes, user: user })
    .from(sessionNotes)
    .innerJoin(user, eq(sessionNotes.authorUserId, user.id))
    .where(eq(sessionNotes.tableId, tableId))
    .orderBy(desc(sessionNotes.createdAt));
  if (!userId || userRole === 'dm') return rows;
  return rows.filter(r => r.note.visibility !== 'dm_only');
}

export async function getSessionNoteById(noteId: string) {
  const [row] = await db
    .select({ note: sessionNotes, user: user })
    .from(sessionNotes)
    .innerJoin(user, eq(sessionNotes.authorUserId, user.id))
    .where(eq(sessionNotes.id, noteId))
    .limit(1);
  return row;
}

export async function getSessionNoteFiles(noteId: string) {
  return db.select().from(noteFiles).where(eq(noteFiles.noteId, noteId));
}

export async function createNoteFile(data: {
  noteId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const [file] = await db.insert(noteFiles).values(data).returning();
  return file;
}

export async function updateSessionNote(id: string, data: Record<string, unknown>) {
  const [updated] = await db
    .update(sessionNotes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sessionNotes.id, id))
    .returning();
  return updated;
}

export async function deleteSessionNote(id: string) {
  await db.delete(sessionNotes).where(eq(sessionNotes.id, id));
}

export async function getSessionLabels(tableId: string) {
  const rows = await db
    .selectDistinct({ label: sessionNotes.sessionLabel })
    .from(sessionNotes)
    .where(and(eq(sessionNotes.tableId, tableId), sql`${sessionNotes.sessionLabel} IS NOT NULL`));
  return rows.map(r => r.label).filter(Boolean) as string[];
}

// ── Dice Rolls ──
export async function createDiceRoll(data: {
  tableId?: string;
  requestId?: string | null;
  createdByUserId: string;
  rollType: string;
  diceExpression: string;
  modifierJson?: unknown;
  resultJson: unknown;
  visibleToPlayers?: boolean;
}) {
  const [roll] = await db
    .insert(diceRolls)
    .values({
      tableId: data.tableId || null,
      requestId: data.requestId,
      createdByUserId: data.createdByUserId,
      rollType: data.rollType,
      diceExpression: data.diceExpression,
      modifierJson: data.modifierJson || null,
      resultJson: data.resultJson,
      visibleToPlayers: data.visibleToPlayers ?? true,
    })
    .returning();
  return roll;
}

export async function getDiceRollsByRequest(requestId: string) {
  return db
    .select({ roll: diceRolls, user: user })
    .from(diceRolls)
    .innerJoin(user, eq(diceRolls.createdByUserId, user.id))
    .where(eq(diceRolls.requestId, requestId))
    .orderBy(desc(diceRolls.createdAt));
}

export async function getDiceRollsByTable(tableId: string) {
  return db
    .select({ roll: diceRolls, user: user })
    .from(diceRolls)
    .innerJoin(user, eq(diceRolls.createdByUserId, user.id))
    .where(eq(diceRolls.tableId, tableId))
    .orderBy(desc(diceRolls.createdAt))
    .limit(50);
}

// ── Downtime Time Windows ──
export async function createTimeWindow(data: {
  tableId: string;
  label: string;
  startAt?: Date | null;
  endAt?: Date | null;
  inWorldDaysAvailable?: number | null;
  notes?: string;
}) {
  const [win] = await db
    .insert(downtimeTimeWindows)
    .values({
      tableId: data.tableId,
      label: data.label,
      startAt: data.startAt || null,
      endAt: data.endAt || null,
      inWorldDaysAvailable: data.inWorldDaysAvailable || null,
      notes: data.notes || null,
    })
    .returning();
  return win;
}

export async function getTimeWindowsByTable(tableId: string) {
  return db
    .select()
    .from(downtimeTimeWindows)
    .where(eq(downtimeTimeWindows.tableId, tableId))
    .orderBy(desc(downtimeTimeWindows.createdAt));
}

export async function updateTimeWindow(id: string, data: Record<string, unknown>) {
  const [updated] = await db
    .update(downtimeTimeWindows)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(downtimeTimeWindows.id, id))
    .returning();
  return updated;
}

export async function deleteTimeWindow(id: string) {
  await db.delete(downtimeTimeWindows).where(eq(downtimeTimeWindows.id, id));
}

export async function allocateTimeToRequest(data: {
  requestId: string;
  timeWindowId: string;
  daysAllocated: number;
}) {
  const [alloc] = await db
    .insert(requestTimeAllocations)
    .values(data)
    .returning();
  return alloc;
}

export async function getTimeAllocationByRequest(requestId: string) {
  const rows = await db
    .select({ alloc: requestTimeAllocations, window: downtimeTimeWindows })
    .from(requestTimeAllocations)
    .innerJoin(downtimeTimeWindows, eq(requestTimeAllocations.timeWindowId, downtimeTimeWindows.id))
    .where(eq(requestTimeAllocations.requestId, requestId));
  return rows;
}

export async function getWindowUsedDays(windowId: string) {
  const rows = await db
    .select({ total: sum(requestTimeAllocations.daysAllocated) })
    .from(requestTimeAllocations)
    .where(eq(requestTimeAllocations.timeWindowId, windowId));
  return rows[0]?.total ? Number(rows[0].total) : 0;
}

// ── AI Settings ──
export async function getAiSettings(tableId: string) {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.tableId, tableId)).limit(1);
  return row || null;
}

export async function upsertAiSettings(tableId: string, data: Record<string, any>) {
  const existing = await getAiSettings(tableId);
  if (existing) {
    const [updated] = await db.update(aiSettings).set({ ...data, updatedAt: new Date() }).where(eq(aiSettings.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(aiSettings).values({ tableId, providerType: 'manual', ...data }).returning();
  return created;
}

// ── AI Jobs ──
export async function createAiJob(data: {
  tableId: string;
  requestedByUserId: string;
  jobType: string;
  triggerType: string;
  inputRefsJson?: unknown;
}) {
  const [job] = await db.insert(aiJobs).values({
    ...data,
    inputRefsJson: data.inputRefsJson || null,
    status: 'pending',
  }).returning();
  return job;
}

export async function updateAiJob(jobId: string, data: {
  status?: string;
  outputText?: string | null;
  outputJson?: unknown;
  reviewedByUserId?: string | null;
  completedAt?: Date | null;
}) {
  const [updated] = await db.update(aiJobs).set(data).where(eq(aiJobs.id, jobId)).returning();
  return updated;
}

export async function getAiJobsByTable(tableId: string) {
  return db.select({ job: aiJobs, user: user }).from(aiJobs).innerJoin(user, eq(aiJobs.requestedByUserId, user.id)).where(eq(aiJobs.tableId, tableId)).orderBy(desc(aiJobs.createdAt));
}

export async function getActiveTimeWindow(tableId: string) {
  const windows = await getTimeWindowsByTable(tableId);
  // Return the most recently created window with days available as the "active" one
  return windows.find(w => w.inWorldDaysAvailable && w.inWorldDaysAvailable > 0) || null;
}

// ── Extracted Entities ──
export async function createExtractedEntity(data: {
  tableId: string;
  sourceType: string;
  sourceId: string;
  entityType: string;
  name: string;
  summary?: string;
  metadataJson?: unknown;
  confidence?: string;
}) {
  const [entity] = await db.insert(extractedEntities).values(data).returning();
  return entity;
}

export async function getEntitiesBySource(sourceType: string, sourceId: string) {
  return db.select().from(extractedEntities)
    .where(and(eq(extractedEntities.sourceType, sourceType), eq(extractedEntities.sourceId, sourceId)))
    .orderBy(desc(extractedEntities.createdAt));
}

// ── Inventory Change Suggestions ──
export async function createInventorySuggestion(data: {
  tableId: string;
  characterSheetId: string;
  sourceType: string;
  sourceId?: string;
  suggestedByUserId?: string | null;
  generatedByAi?: boolean;
  changeType: string;
  itemName?: string | null;
  normalizedItemKey?: string | null;
  quantityDelta?: number | null;
  currencyDeltaJson?: unknown | null;
  itemType?: string | null;
  rationale?: string | null;
  confidence?: string | null;
  duplicateCheckStatus?: string | null;
}) {
  const [sug] = await db.insert(inventoryChangeSuggestions).values(data).returning();
  return sug;
}

export async function getSuggestionsByRequest(sourceId: string) {
  return db.select().from(inventoryChangeSuggestions)
    .where(eq(inventoryChangeSuggestions.sourceId, sourceId))
    .orderBy(desc(inventoryChangeSuggestions.createdAt));
}

export async function getSuggestionsByCharacter(characterSheetId: string) {
  return db.select().from(inventoryChangeSuggestions)
    .where(eq(inventoryChangeSuggestions.characterSheetId, characterSheetId))
    .orderBy(desc(inventoryChangeSuggestions.createdAt));
}

export async function updateSuggestion(id: string, data: {
  reviewStatus?: string;
  reviewedByUserId?: string;
  reviewedAt?: Date;
  itemName?: string;
  changeType?: string;
  quantityDelta?: number;
  rationale?: string;
}) {
  const [updated] = await db.update(inventoryChangeSuggestions).set(data)
    .where(eq(inventoryChangeSuggestions.id, id)).returning();
  return updated;
}

// ── Inventory apply helpers ──
export async function addInventoryItem(data: {
  characterSheetId: string;
  name: string;
  quantity?: number;
  itemType?: string;
  description?: string;
  magic?: boolean;
  rarity?: string;
  sourceType?: string;
  sourceId?: string;
}) {
  const [item] = await db.insert(inventoryItems).values({
    ...data,
    quantity: data.quantity ?? 1,
    itemType: data.itemType || 'gear',
    description: data.description || null,
    magic: data.magic ?? false,
    rarity: data.rarity || null,
    sourceType: data.sourceType || 'ai_suggestion',
    sourceId: data.sourceId || null,
  }).returning();
  return item;
}

export async function removeInventoryItem(id: string, quantity?: number) {
  if (quantity != null && quantity > 0) {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
    if (!item) return;
    const newQty = Math.max(0, item.quantity - quantity);
    if (newQty === 0) {
      await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    } else {
      await db.update(inventoryItems).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryItems.id, id));
    }
  } else {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  }
}

export async function updateInventoryItemQuantity(id: string, delta: number) {
  const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
  if (!item) return;
  const newQty = Math.max(0, item.quantity + delta);
  await db.update(inventoryItems).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryItems.id, id));
  return newQty;
}

export async function updateCharacterCurrency(characterSheetId: string, deltaJson: Record<string, number>) {
  const [cur] = await db.select().from(characterCurrency)
    .where(eq(characterCurrency.characterSheetId, characterSheetId)).limit(1);
  if (!cur) {
    // Create with defaults + delta
    const defaults = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    const vals = { ...defaults };
    for (const [k, v] of Object.entries(deltaJson)) {
      if (k in vals) vals[k as keyof typeof vals] = (vals[k as keyof typeof vals] || 0) + v;
    }
    const [created] = await db.insert(characterCurrency).values({ characterSheetId, ...vals }).returning();
    return created;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(deltaJson)) {
    if (k in cur) {
      updates[k] = Math.max(0, (cur as any)[k] + v);
    }
  }
  const [updated] = await db.update(characterCurrency).set(updates)
    .where(eq(characterCurrency.characterSheetId, characterSheetId)).returning();
  return updated;
}

// ── DM Plans ──
export async function getDmPlansByTable(tableId: string) {
  return db.select().from(dmPlans).where(eq(dmPlans.tableId, tableId)).orderBy(dmPlans.sortOrder, desc(dmPlans.createdAt));
}

export async function createDmPlan(data: { tableId: string; authorUserId: string; title: string; body?: string; sessionLabel?: string | null; tags?: string[]; sortOrder?: number }) {
  const [plan] = await db.insert(dmPlans).values({
    tableId: data.tableId,
    authorUserId: data.authorUserId,
    title: data.title,
    body: data.body || '',
    sessionLabel: data.sessionLabel || null,
    tags: data.tags || [],
    sortOrder: data.sortOrder ?? 0,
  }).returning();
  return plan;
}

export async function updateDmPlan(id: string, data: Partial<{ title: string; body: string; sessionLabel: string | null; tags: string[]; sortOrder: number }>) {
  await db.update(dmPlans).set({ ...data, updatedAt: new Date() }).where(eq(dmPlans.id, id));
}

export async function deleteDmPlan(id: string) {
  await db.delete(dmPlans).where(eq(dmPlans.id, id));
}

export async function findInventoryItemByName(characterSheetId: string, name: string) {
  const rows = await db.select().from(inventoryItems)
    .where(and(eq(inventoryItems.characterSheetId, characterSheetId), sql`LOWER(${inventoryItems.name}) = LOWER(${name})`))
    .limit(1);
  return rows[0] || null;
}

// ── Loot Entries ──
export async function getLootEntries(tableId: string, filters?: { category?: string; rarity?: string; itemType?: string; isHomebrew?: boolean }) {
  const conditions = [eq(lootEntries.tableId, tableId)];
  if (filters?.category) conditions.push(eq(lootEntries.category, filters.category));
  if (filters?.rarity) conditions.push(eq(lootEntries.rarity, filters.rarity));
  if (filters?.itemType) conditions.push(eq(lootEntries.itemType, filters.itemType));
  if (filters?.isHomebrew !== undefined) conditions.push(eq(lootEntries.isHomebrew, filters.isHomebrew));
  return db.select().from(lootEntries).where(and(...conditions)).orderBy(desc(lootEntries.createdAt));
}

export async function createLootEntry(data: {
  tableId: string;
  category?: string;
  itemName: string;
  itemType?: string;
  rarity?: string;
  quantity?: number;
  valueGp?: number;
  description?: string;
  isHomebrew?: boolean;
  sourceRef?: string;
  awardedToCharacterId?: string;
  createdByUserId: string;
  notes?: string;
}) {
  const [entry] = await db.insert(lootEntries).values({
    tableId: data.tableId,
    category: data.category || 'loot',
    itemName: data.itemName,
    itemType: data.itemType || 'wondrous',
    rarity: data.rarity || 'common',
    quantity: data.quantity || 1,
    valueGp: data.valueGp != null ? String(data.valueGp) : '0',
    description: data.description || null,
    isHomebrew: data.isHomebrew || false,
    sourceRef: data.sourceRef || null,
    awardedToCharacterId: data.awardedToCharacterId || null,
    createdByUserId: data.createdByUserId,
    notes: data.notes || null,
  }).returning();
  return entry;
}

export async function updateLootEntry(id: string, data: Record<string, any>) {
  const { id: _id, ...fields } = data;
  const set: Record<string, any> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) set[k] = v;
  }
  const [entry] = await db.update(lootEntries).set(set).where(eq(lootEntries.id, id)).returning();
  return entry;
}

export async function deleteLootEntry(id: string) {
  await db.delete(lootEntries).where(eq(lootEntries.id, id));
}
