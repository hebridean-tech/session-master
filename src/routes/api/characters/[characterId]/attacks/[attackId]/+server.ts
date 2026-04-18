import { db } from '$lib/db';
import { characterAttacks } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const updates: any = { updatedAt: new Date() };
  for (const key of ['name','attackBonus','damage','damageType','abilityUsed','actionType','rangeType','rangeFt','isProficient','isMagical','isVersatile','versatileDamage']) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  const [updated] = await db.update(characterAttacks).set(updates)
    .where(and(eq(characterAttacks.id, params.attackId), eq(characterAttacks.characterSheetId, params.characterId)))
    .returning();
  return json(updated);
};
