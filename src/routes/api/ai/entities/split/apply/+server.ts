import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { extractedEntities } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserTableRole } from '$lib/db/queries';
import { createExtractedEntity } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { entityId, tableId, entities: newEntities } = await request.json();
  if (!entityId || !tableId || !Array.isArray(newEntities) || newEntities.length < 2) {
    return json({ error: 'Missing fields or need 2+ entities' }, { status: 400 });
  }

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    // Fetch original entity to get source info
    const originals = await db.select().from(extractedEntities).where(eq(extractedEntities.id, entityId));
    if (!originals.length) return json({ error: 'Entity not found' }, { status: 404 });

    const orig = originals[0];

    // Create new entities
    for (const e of newEntities) {
      await createExtractedEntity({
        tableId: orig.tableId,
        sourceType: orig.sourceType,
        sourceId: orig.sourceId,
        entityType: e.type || 'NPC',
        name: String(e.name).slice(0, 255),
        summary: e.summary ? String(e.summary).slice(0, 1000) : undefined,
        metadataJson: { aiExtracted: true, splitFrom: entityId },
        confidence: orig.confidence,
      });
    }

    // Delete original entity
    await db.delete(extractedEntities).where(eq(extractedEntities.id, entityId));

    return json({ success: true, created: newEntities.length });
  } catch (e: any) {
    return json({ error: e.message || 'Split failed' }, { status: 500 });
  }
};
