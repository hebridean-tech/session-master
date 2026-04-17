import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTableRole } from '$lib/db/queries';
import { db } from '$lib/db';
import { tables } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { tableId, level } = await request.json();
  if (!tableId || level == null) return json({ error: 'Missing tableId or level' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'Forbidden' }, { status: 403 });

  const parsed = Math.max(1, Math.min(20, parseInt(level, 10)));
  const [updated] = await db.update(tables).set({ currentLevel: parsed, updatedAt: new Date() }).where(eq(tables.id, tableId)).returning();
  return json({ success: true, level: updated.currentLevel });
};
