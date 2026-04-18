import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { extractedEntities } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserTableRole, getAiSettings } from '$lib/db/queries';
import { callAi, type AiProviderConfig } from '$lib/ai/provider';

function toProviderConfig(settings: NonNullable<Awaited<ReturnType<typeof getAiSettings>>>): AiProviderConfig {
  return {
    providerType: settings.providerType as AiProviderConfig['providerType'],
    hostedProvider: settings.hostedProvider || null,
    endpointUrl: settings.endpointUrl,
    modelName: settings.modelName,
    apiKey: settings.apiKeyRef || null,
  };
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { tableId, entityIds } = await request.json();
  if (!tableId || !entityIds || !Array.isArray(entityIds)) {
    return json({ error: 'Missing fields' }, { status: 400 });
  }

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  const settings = await getAiSettings(tableId);
  if (!settings || settings.permissionLevel < 1) {
    return json({ error: 'AI not configured' }, { status: 400 });
  }

  // Fetch all entities
  const entities = await db.select().from(extractedEntities)
    .where(eq(extractedEntities.tableId, tableId));

  const entityMap = new Map(entities.map(e => [e.id, e]));

  // Send to AI to identify duplicate groups
  const entityList = entityIds.map(id => {
    const e = entityMap.get(id);
    return e ? `${id}: ${e.name} (${e.entityType}) — ${e.summary || 'no summary'}` : null;
  }).filter(Boolean).join('\n');

  const result = await callAi(toProviderConfig(settings), [
    {
      role: 'system',
      content: `You are identifying duplicate entities in a D&D campaign knowledge base.

Given a list of entities with IDs, identify which ones are duplicates (same person, place, or thing referred to by different names).

DUPLICATE RULES:
- Different names referring to the same entity are duplicates (e.g. "my brother" and "Parzival", "the inn" and "The Sleeping Giant")
- Same name same type = always a duplicate
- Nicknames, titles, and pronoun references ("my brother", "the old man") that clearly refer to another named entity = duplicate
- Same name but different types (e.g. "Elara" as NPC vs "Elara" as Location) are NOT duplicates unless context clearly shows they're the same

Return ONLY a JSON array of merge groups. Each group is an array of entity IDs, with the FIRST ID being the primary (keep this one):
[["primary_id", "alias_id1", "alias_id2"], ...]

Only include groups with 2+ entities. If no duplicates, return [].
Return ONLY valid JSON, no markdown.`,
    },
    { role: 'user', content: entityList },
  ], { maxTokens: 1024, temperature: 0.1 });

  let groups: string[][];
  try {
    const cleaned = result.content
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim();
    // Extract JSON array from response (may have leading/trailing text)
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrMatch) throw new Error('No array found');
    groups = JSON.parse(arrMatch[0]);
  } catch (e) {
    console.error('Auto-merge AI parse error:', e, 'Raw:', result.content);
    return json({ error: 'AI returned invalid JSON' }, { status: 500 });
  }

  if (!Array.isArray(groups)) return json({ error: 'Invalid response format' }, { status: 500 });

  const merged = [];
  for (const group of groups) {
    if (!Array.isArray(group) || group.length < 2) continue;
    const [primaryId, ...aliasIds] = group;
    const primary = entityMap.get(primaryId);
    if (!primary) continue;

    for (const aliasId of aliasIds) {
      const alias = entityMap.get(aliasId);
      if (!alias) continue;

      // Merge summaries
      let mergedSummary = primary.summary || alias.summary || '';
      if (alias.summary && primary.summary && alias.summary !== primary.summary) {
        try {
          const r = await callAi(toProviderConfig(settings), [
            { role: 'system', content: 'Merge two entity descriptions into one concise summary (1-2 sentences). Combine unique info.' },
            { role: 'user', content: `"${primary.name}": ${primary.summary}\n"${alias.name}": ${alias.summary}` },
          ], { maxTokens: 256, temperature: 0.2 });
          mergedSummary = r.content;
        } catch { /* keep primary */ }
      }

      await db.update(extractedEntities).set({
        summary: mergedSummary,
        metadataJson: { ...((primary.metadataJson as Record<string, any>) || {}), mergedWith: [...(((primary.metadataJson as Record<string, any>)?.mergedWith) || []), aliasId] },
      }).where(eq(extractedEntities.id, primaryId));

      await db.update(extractedEntities).set({
        metadataJson: { ...((alias.metadataJson as Record<string, any>) || {}), aliasOf: primaryId, aliasOfName: primary.name },
      }).where(eq(extractedEntities.id, aliasId));

      merged.push({ primary: primary.name, alias: alias.name });
    }
  }

  return json({ success: true, merged });
};
