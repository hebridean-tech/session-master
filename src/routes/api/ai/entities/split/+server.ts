import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { extractedEntities } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
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

  const { entityId, tableId } = await request.json();
  if (!entityId || !tableId) return json({ error: 'Missing fields' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  const settings = await getAiSettings(tableId);
  if (!settings || settings.permissionLevel < 1) return json({ error: 'AI not configured' }, { status: 400 });

  const entities = await db.select().from(extractedEntities).where(eq(extractedEntities.id, entityId));
  if (!entities.length) return json({ error: 'Entity not found' }, { status: 404 });

  const entity = entities[0];

  const result = await callAi(toProviderConfig(settings), [
    {
      role: 'system',
      content: `Analyze this D&D campaign entity. Its name or summary may conflate multiple distinct things.

For example, "Hydra Parzival" might actually be "Parzival" (a person) and "a hydra" (a monster).
Or "Ichtor's Pass" might conflate "Ichtor" (a person) and "Ichtor's Pass" (a location).

Decompose into separate entities. Each should have: name, type (NPC/Location/Quest/Faction/Item/Rumor/Player Character), and summary.
If the entity genuinely refers to one thing, return an empty array.

Return ONLY a JSON array, no markdown fences:
[{"name":"...","type":"...","summary":"..."}]`,
    },
    { role: 'user', content: `Name: ${entity.name}\nType: ${entity.entityType}\nSummary: ${entity.summary || 'none'}` },
  ], { maxTokens: 1024, temperature: 0.2 });

  let suggestions: any[];
  try {
    const cleaned = result.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrMatch) throw new Error('No array found');
    suggestions = JSON.parse(arrMatch[0]);
  } catch {
    return json({ success: true, suggestions: [] });
  }

  if (!Array.isArray(suggestions) || suggestions.length < 2) {
    return json({ success: true, suggestions: [] });
  }

  const validTypes = ['NPC', 'Location', 'Quest', 'Faction', 'Item', 'Rumor', 'Player Character'];
  const filtered = suggestions
    .filter(s => s.name && validTypes.includes(s.type))
    .map(s => ({ name: String(s.name).slice(0, 255), type: s.type, summary: String(s.summary || '').slice(0, 1000) }));

  return json({ success: true, suggestions: filtered.length >= 2 ? filtered : [] });
};
