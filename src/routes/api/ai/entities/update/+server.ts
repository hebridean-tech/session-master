import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { extractedEntities } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserTableRole } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { entityId, name, entityType } = await request.json();
  if (!entityId) return json({ error: 'Missing entityId' }, { status: 400 });

  // Fetch entity to get tableId for role check
  const entity = await db.select().from(extractedEntities).where(eq(extractedEntities.id, entityId)).limit(1);
  if (!entity.length) return json({ error: 'Entity not found' }, { status: 404 });

  const role = await getUserTableRole(session.user.id, entity[0].tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  const validTypes = ['NPC', 'Location', 'Quest', 'Faction', 'Item', 'Rumor', 'Player Character'];

  try {
    const updates: Record<string, any> = {};
    if (name && typeof name === 'string') updates.name = name.slice(0, 255);
    if (entityType && validTypes.includes(entityType)) updates.entityType = entityType;

    if (Object.keys(updates).length === 0) {
      return json({ error: 'Nothing to update' }, { status: 400 });
    }

    await db.update(extractedEntities).set(updates).where(eq(extractedEntities.id, entityId));
    return json({ success: true });
  } catch {
    return json({ error: 'Update failed' }, { status: 500 });
  }
};
