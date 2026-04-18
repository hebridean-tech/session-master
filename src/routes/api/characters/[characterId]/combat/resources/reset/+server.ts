import { db } from '$lib/db';
import { combatResources, characterSheets } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterId } = params;
  const { type } = await request.json();
  if (!type || !['short_rest', 'long_rest'].includes(type)) return json({ error: 'Invalid type' }, { status: 400 });

  const [sheet] = await db.select().from(characterSheets).where(eq(characterSheets.id, characterId)).limit(1);
  if (!sheet) return json({ error: 'Not found' }, { status: 404 });

  const allResources = await db.select().from(combatResources).where(eq(combatResources.characterSheetId, characterId));

  for (const r of allResources) {
    const shouldReset = type === 'long_rest' || r.resourceType === 'short_rest';
    if (shouldReset) {
      await db.update(combatResources).set({ current: r.max, updatedAt: new Date() }).where(eq(combatResources.id, r.id));
    }
  }

  // Long rest: full HP
  if (type === 'long_rest' && sheet.hpMax) {
    await db.update(characterSheets).set({ hpCurrent: sheet.hpMax, updatedAt: new Date() }).where(eq(characterSheets.id, characterId));
  }

  const updated = await db.select().from(combatResources).where(eq(combatResources.characterSheetId, characterId));
  return json({ resources: updated });
};
