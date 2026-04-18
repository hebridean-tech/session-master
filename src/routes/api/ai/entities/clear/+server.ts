import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { extractedEntities } from '$lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getUserTableRole } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { tableId, entityIds } = await request.json();
  if (!tableId || !entityIds || !Array.isArray(entityIds)) {
    return json({ error: 'Missing fields' }, { status: 400 });
  }

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    await db.delete(extractedEntities).where(
      and(eq(extractedEntities.tableId, tableId), inArray(extractedEntities.id, entityIds))
    );
  } catch (e: any) {
    return json({ error: 'Delete failed' }, { status: 500 });
  }

  return json({ success: true, deleted: entityIds.length });
};
