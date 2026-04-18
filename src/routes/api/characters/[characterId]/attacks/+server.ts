import { db } from '$lib/db';
import { characterAttacks } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const [attack] = await db.insert(characterAttacks).values({
    characterSheetId: params.characterId,
    name: body.name || 'New Attack',
    attackBonus: body.attackBonus ?? null,
    damage: body.damage || null,
    damageType: body.damageType || null,
    abilityUsed: body.abilityUsed || null,
    actionType: body.actionType || 'action',
    rangeType: body.rangeType || 'melee',
    rangeFt: body.rangeFt ?? null,
    isProficient: body.isProficient ?? true,
    isMagical: body.isMagical ?? false,
    isVersatile: body.isVersatile ?? false,
    versatileDamage: body.versatileDamage || null,
    sourceType: 'manual',
  }).returning();
  return json(attack, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  await db.delete(characterAttacks).where(
    and(eq(characterAttacks.id, params.attackId), eq(characterAttacks.characterSheetId, params.characterId))
  );
  return json({ ok: true });
};
