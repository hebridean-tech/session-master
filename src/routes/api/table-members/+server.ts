import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTableById, getUserTableRole, removeTableMember, deduplicateTableMembers } from '$lib/db/queries';
import { eq, and } from 'drizzle-orm';
import { tableMembers } from '$lib/db/schema';
import { db } from '$lib/db';

// Remove a member from a table (DM only)
export const DELETE: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { memberId, tableId } = await request.json();
  if (!memberId || !tableId) return json({ error: 'Missing fields' }, { status: 400 });

  const role = await getUserTableRole(locals.session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'Forbidden — DM only' }, { status: 403 });
  if (memberId === role.id) return json({ error: 'Cannot remove yourself' }, { status: 400 });

  try {
    await removeTableMember(memberId, tableId);
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Failed to remove member' }, { status: 500 });
  }
};

// Deduplicate members (DM only)
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { tableId } = await request.json();
  if (!tableId) return json({ error: 'Missing tableId' }, { status: 400 });

  const role = await getUserTableRole(locals.session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'Forbidden — DM only' }, { status: 403 });

  const removed = await deduplicateTableMembers(tableId);
  return json({ success: true, removed });
};
