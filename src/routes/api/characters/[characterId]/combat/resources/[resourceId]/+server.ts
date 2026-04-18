import { db } from '$lib/db';
import { combatResources } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterId, resourceId } = params;
  const { current } = await request.json();
  if (current == null) return json({ error: 'Missing current' }, { status: 400 });

  const [updated] = await db.update(combatResources)
    .set({ current, updatedAt: new Date() })
    .where(eq(combatResources.id, resourceId))
    .returning();
  return json(updated);
};
