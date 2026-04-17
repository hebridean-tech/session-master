// AI Feature Functions — Note Summarization, Entity Extraction, Inventory Suggestions

import { callAi, type AiProviderConfig } from './provider';
import {
  getSessionNoteById, getAiSettings, createAiJob, updateAiJob,
  createExtractedEntity, getEntitiesBySource,
  getRequestById, createInventorySuggestion, getSuggestionsByRequest,
  findInventoryItemByName,
} from '$lib/db/queries';

function toProviderConfig(settings: NonNullable<Awaited<ReturnType<typeof getAiSettings>>>): AiProviderConfig {
  return {
    providerType: settings.providerType as AiProviderConfig['providerType'],
    endpointUrl: settings.endpointUrl,
    modelName: settings.modelName,
    apiKey: settings.apiKeyRef || null,
  };
}

// ── 5.4: Note Summarization ──
export async function summarizeNote(noteId: string, tableId: string, userId: string) {
  const noteRow = await getSessionNoteById(noteId);
  if (!noteRow) throw new Error('Note not found');

  const settings = await getAiSettings(tableId);
  if (!settings || settings.permissionLevel < 1) throw new Error('AI not enabled or insufficient permissions');

  const job = await createAiJob({
    tableId, requestedByUserId: userId, jobType: 'note_summary', triggerType: 'manual',
    inputRefsJson: { noteId },
  });

  try {
    const result = await callAi(toProviderConfig(settings), [
      {
        role: 'system',
        content: 'You are a D&D campaign note assistant Summarize the following session note in a concise format. Highlight key events, NPCs mentioned, locations visited, combat encounters, loot obtained, and any unresolved plot threads. Format in markdown.',
      },
      { role: 'user', content: noteRow.note.body },
    ], { maxTokens: 1024, temperature: 0.3 });

    await updateAiJob(job.id, {
      status: 'completed',
      outputText: result.content,
      completedAt: new Date(),
    });

    return { summary: result.content, jobId: job.id };
  } catch (e: any) {
    await updateAiJob(job.id, { status: 'failed', outputText: e.message, completedAt: new Date() });
    throw e;
  }
}

// ── 5.5: Entity Extraction ──
interface ExtractedEntity {
  name: string;
  type: 'NPC' | 'Location' | 'Quest' | 'Faction' | 'Item' | 'Rumor';
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function extractEntities(noteId: string, tableId: string, userId: string) {
  const noteRow = await getSessionNoteById(noteId);
  if (!noteRow) throw new Error('Note not found');

  const settings = await getAiSettings(tableId);
  if (!settings || settings.permissionLevel < 1) throw new Error('AI not enabled or insufficient permissions');

  const job = await createAiJob({
    tableId, requestedByUserId: userId, jobType: 'entity_extraction', triggerType: 'manual',
    inputRefsJson: { noteId },
  });

  try {
    const result = await callAi(toProviderConfig(settings), [
      {
        role: 'system',
        content: `Extract named entities from this D&D session note. Categorize each as: NPC, Location, Quest, Faction, Item, or Rumor. For each entity provide: name, type, a brief summary (1-2 sentences), and confidence (high/medium/low). Return ONLY a JSON array, no markdown fences. Example: [{"name":"Gandalf","type":"NPC","summary":"A wise wizard","confidence":"high"}]`,
      },
      { role: 'user', content: noteRow.note.body },
    ], { maxTokens: 2048, temperature: 0.2 });

    let entities: ExtractedEntity[];
    try {
      const cleaned = result.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      entities = JSON.parse(cleaned);
    } catch {
      throw new Error('AI returned invalid JSON for entity extraction');
    }

    if (!Array.isArray(entities)) throw new Error('AI response is not an array');

    const validTypes = ['NPC', 'Location', 'Quest', 'Faction', 'Item', 'Rumor'];
    const confidenceMap: Record<string, number> = { high: 0.9, medium: 0.5, low: 0.1 };
    const inserted = [];
    for (const e of entities) {
      if (!e.name || !validTypes.includes(e.type)) continue;
      const entity = await createExtractedEntity({
        tableId,
        sourceType: 'session_note',
        sourceId: noteId,
        entityType: e.type,
        name: String(e.name).slice(0, 255),
        summary: e.summary ? String(e.summary).slice(0, 1000) : undefined,
        metadataJson: { aiExtracted: true },
        confidence: String(confidenceMap[e.confidence] || 0.5),
      });
      inserted.push(entity);
    }

    await updateAiJob(job.id, {
      status: 'completed',
      outputJson: { count: inserted.length, entities: inserted.map(e => e.id) } as any,
      completedAt: new Date(),
    });

    return { entities: inserted, jobId: job.id };
  } catch (e: any) {
    await updateAiJob(job.id, { status: 'failed', outputText: e.message, completedAt: new Date() });
    throw e;
  }
}

// ── 5.6: Inventory Suggestions ──
interface InventorySuggestion {
  item_name: string;
  change_type: 'add_item' | 'remove_item' | 'quantity_change' | 'currency_change';
  quantity_delta?: number;
  currency_delta_json?: Record<string, number>;
  rationale: string;
}

export async function suggestInventoryChanges(requestId: string, tableId: string, userId: string) {
  const reqRow = await getRequestById(requestId);
  if (!reqRow) throw new Error('Request not found');

  const settings = await getAiSettings(tableId);
  if (!settings || settings.permissionLevel < 2) throw new Error('AI permission level too low (requires level 2+)');

  const enabledActions = (settings.enabledActionsJson as Record<string, boolean>) || {};
  if (!enabledActions.inventory_suggestions) throw new Error('Inventory suggestions not enabled in AI settings');

  const job = await createAiJob({
    tableId, requestedByUserId: userId, jobType: 'inventory_suggestion', triggerType: 'manual',
    inputRefsJson: { requestId },
  });

  try {
    const req = reqRow.request
    const prompt = `Based on this D&D downtime action and its outcome, suggest inventory changes for the character. Consider items gained, items consumed, gold spent, materials used.

Title: ${req.title}
Category: ${req.category}
Description: ${req.description}
Outcome: ${req.outcomeSummary || 'N/A'}
DM Ruling: ${req.dmRuling || 'N/A'}
Gold Cost Approved: ${req.goldCostApproved ?? 'N/A'} gp

Return ONLY a JSON array, no markdown fences. Each entry: {"item_name":"...","change_type":"add_item|remove_item|quantity_change|currency_change","quantity_delta":N,"currency_delta_json":{"gp":N},"rationale":"..."}
Example: [{"item_name":"Healing Potion","change_type":"add_item","quantity_delta":2,"rationale":"Crafted during downtime"}]`;

    const result = await callAi(toProviderConfig(settings), [
      { role: 'system', content: 'You are a D&D inventory management assistant. Suggest inventory changes based on downtime action outcomes. Return only JSON arrays.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 1024, temperature: 0.3 });

    let suggestions: InventorySuggestion[];
    try {
      const cleaned = result.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      suggestions = JSON.parse(cleaned);
    } catch {
      throw new Error('AI returned invalid JSON for inventory suggestions');
    }

    if (!Array.isArray(suggestions)) throw new Error('AI response is not an array');

    const validChangeTypes = ['add_item', 'remove_item', 'quantity_change', 'currency_change'];
    const characterSheetId = req.characterSheetId;
    if (!characterSheetId) throw new Error('Request has no linked character sheet');

    const inserted = [];
    for (const s of suggestions) {
      if (!s.change_type || !validChangeTypes.includes(s.change_type)) continue;
      if (s.change_type !== 'currency_change' && !s.item_name) continue;

      const normalizedKey = s.item_name ? s.item_name.toLowerCase().trim() : 'currency';

      // Duplicate detection
      const existing = await getSuggestionsByRequest(requestId);
      const isDuplicate = existing.some(e =>
        e.normalizedItemKey === normalizedKey && e.changeType === s.change_type
      );

      const suggestion = await createInventorySuggestion({
        tableId,
        characterSheetId,
        sourceType: 'downtime_request',
        sourceId: requestId,
        suggestedByUserId: userId,
        generatedByAi: true,
        changeType: s.change_type,
        itemName: s.item_name || null,
        normalizedItemKey: normalizedKey,
        quantityDelta: s.quantity_delta ?? null,
        currencyDeltaJson: s.currency_delta_json || null,
        rationale: s.rationale || null,
        confidence: 'medium',
        duplicateCheckStatus: isDuplicate ? 'duplicate_found' : 'unique',
      });
      inserted.push(suggestion);
    }

    await updateAiJob(job.id, {
      status: 'completed',
      outputJson: { count: inserted.length, suggestions: inserted.map(s => s.id) } as any,
      completedAt: new Date(),
    });

    return { suggestions: inserted, jobId: job.id };
  } catch (e: any) {
    await updateAiJob(job.id, { status: 'failed', outputText: e.message, completedAt: new Date() });
    throw e;
  }
}
