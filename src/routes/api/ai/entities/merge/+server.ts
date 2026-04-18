import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { extractedEntities } from '$lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
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

  const { tableId, entityId, aliasId } = await request.json();
  if (!tableId || !entityId || !aliasId) return json({ error: 'Missing fields' }, { status: 400 });
  if (entityId === aliasId) return json({ error: 'Cannot merge an entity with itself' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    // Fetch both entities
    const [primary] = await db.select().from(extractedEntities)
      .where(eq(extractedEntities.id, entityId)).limit(1);
    const [alias] = await db.select().from(extractedEntities)
      .where(eq(extractedEntities.id, aliasId)).limit(1);

    if (!primary || !alias) return json({ error: 'Entity not found' }, { status: 404 });
    if (primary.tableId !== tableId || alias.tableId !== tableId) return json({ error: 'Entity not in this table' }, { status: 400 });

    // Use AI to merge summaries intelligently
    const settings = await getAiSettings(tableId);
    let mergedSummary = primary.summary || alias.summary || '';
    let mergedName = primary.name;

    if (settings && settings.permissionLevel >= 1 && alias.summary && primary.summary) {
      try {
        const result = await callAi(toProviderConfig(settings), [
          {
            role: 'system',
            content: `Merge two entity descriptions into one concise summary. Combine any unique information. Keep it to 1-3 sentences.`,
          },
          {
            role: 'user',
            content: `Entity 1 (${primary.name}, ${primary.entityType}): ${primary.summary}\nEntity 2 (${alias.name}, ${alias.entityType}): ${alias.summary}`,
          },
        ], { maxTokens: 256, temperature: 0.2 });
        mergedSummary = result.content;
      } catch { /* fallback to primary summary */ }
    }

    // Update alias entity to point to primary as an alias
    await db.update(extractedEntities).set({
      name: alias.name, // keep original alias name for reference
      summary: mergedSummary,
      metadataJson: { ...((alias.metadataJson as Record<string, any>) || {}), aliasOf: primary.id, aliasOfName: primary.name },
      confidence: Math.max(Number(primary.confidence) || 0.5, Number(alias.confidence) || 0.5),
    }).where(eq(extractedEntities.id, aliasId));

    // Also update primary with merged info
    await db.update(extractedEntities).set({
      summary: mergedSummary,
      metadataJson: { ...((primary.metadataJson as Record<string, any>) || {}), mergedWith: aliasId, mergedWithName: alias.name },
    }).where(eq(extractedEntities.id, entityId));

    return json({
      success: true,
      primary: { id: entityId, name: mergedName, summary: mergedSummary },
      alias: { id: aliasId, name: alias.name, aliasOf: primary.name },
    });
  } catch (e: any) {
    return json({ error: e.message || 'Database error' }, { status: 500 });
  }
};
