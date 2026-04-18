import { db } from '$lib/db';
import { characterAttacks, inventoryItems, characterSheets } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterId } = params;

  const [sheet] = await db.select().from(characterSheets).where(eq(characterSheets.id, characterId)).limit(1);
  if (!sheet) return json({ error: 'Not found' }, { status: 404 });

  const scores = sheet.abilityScoresJson as Record<string, number> || {};
  const mod = (s: number) => Math.floor((s - 10) / 2);
  const prof = sheet.proficiencyBonus || 2;

  const weapons = await db.select().from(inventoryItems).where(
    and(eq(inventoryItems.characterSheetId, characterId), eq(inventoryItems.equipped, true))
  );

  const existingAttacks = await db.select().from(characterAttacks).where(eq(characterAttacks.characterSheetId, characterId));
  const syncedItemIds = new Set(existingAttacks.filter(a => a.sourceType === 'inventory' && a.sourceItemId).map(a => a.sourceItemId));

  let created = 0;
  for (const w of weapons) {
    if (syncedItemIds.has(w.id)) continue;
    if (!['weapon', 'ammunition', 'adventuring gear'].includes(w.itemType.toLowerCase())) continue;

    // Heuristic: default melee with STR, finesse/ranged with DEX
    const desc = (w.description || '').toLowerCase();
    const isFinesse = desc.includes('finesse');
    const isRanged = desc.includes('ranged') || w.name.toLowerCase().includes('bow') || w.name.toLowerCase().includes('crossbow');

    const ability = isFinesse || isRanged ? 'DEX' : 'STR';
    const abilityMod = mod(scores[ability.toLowerCase() || 'str'] || 10);
    const attackBonus = prof + abilityMod;

    await db.insert(characterAttacks).values({
      characterSheetId: characterId,
      name: w.name,
      attackBonus,
      damage: null, // user fills in
      damageType: null,
      abilityUsed: ability,
      actionType: 'action',
      rangeType: isRanged ? 'ranged' : 'melee',
      isMagical: w.magic,
      sourceType: 'inventory',
      sourceItemId: w.id,
    });
    created++;
  }

  const allAttacks = await db.select().from(characterAttacks).where(eq(characterAttacks.characterSheetId, characterId));
  return json({ created, attacks: allAttacks });
};
