import { db } from '$lib/db';
import { characterAttacks, inventoryItems, characterSheets } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Items that are weapons regardless of item_type
const WEAPON_NAMES = [
  'sword', 'dagger', 'axe', 'mace', 'hammer', 'flail', 'glaive', 'halberd', 'lance', 'pike',
  'rapier', 'scimitar', 'spear', 'trident', 'war pick', 'warhammer', 'longsword', 'shortsword',
  'greatsword', 'greataxe', 'maul', 'morningstar', 'quarterstaff', 'whip', 'club', 'javelin',
  'bow', 'crossbow', 'sling', 'blowgun', 'handaxe', 'dart', 'net', 'scythe',
];

function isWeapon(name: string, itemType: string): boolean {
  const n = name.toLowerCase();
  if (itemType.toLowerCase() === 'weapon') return true;
  return WEAPON_NAMES.some(w => n.includes(w));
}

function isRangedWeapon(name: string, description: string): boolean {
  const n = name.toLowerCase();
  const d = (description || '').toLowerCase();
  return n.includes('bow') || n.includes('crossbow') || n.includes('sling') || n.includes('blowgun') || n.includes('dart') || d.includes('ranged weapon');
}

function isFinesse(name: string, description: string): boolean {
  const n = name.toLowerCase();
  const d = (description || '').toLowerCase();
  return d.includes('finesse') || n.includes('rapier') || n.includes('dagger') || n.includes('whip') || n.includes('scimitar');
}

function isTwoHanded(name: string, description: string): boolean {
  const n = name.toLowerCase();
  const d = (description || '').toLowerCase();
  return d.includes('two-handed') || n.includes('greatsword') || n.includes('greataxe') || n.includes('glaive') || n.includes('halberd') || n.includes('maul') || n.includes('pike') || n.includes('longbow') || n.includes('heavy crossbow');
}

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterId } = params;

  const [sheet] = await db.select().from(characterSheets).where(eq(characterSheets.id, characterId)).limit(1);
  if (!sheet) return json({ error: 'Not found' }, { status: 404 });

  const scores = sheet.abilityScoresJson as Record<string, number> || {};
  const mod = (s: number) => Math.floor((s - 10) / 2);
  const prof = sheet.proficiencyBonus || 2;

  const weapons = await db.select().from(inventoryItems).where(
    eq(inventoryItems.characterSheetId, characterId)
  );

  const existingAttacks = await db.select().from(characterAttacks).where(eq(characterAttacks.characterSheetId, characterId));
  const syncedItemIds = new Set(existingAttacks.filter(a => a.sourceType === 'inventory' && a.sourceItemId).map(a => a.sourceItemId));

  let created = 0;
  for (const w of weapons) {
    if (syncedItemIds.has(w.id)) continue;
    if (!isWeapon(w.name, w.itemType)) continue;

    const isRange = isRangedWeapon(w.name, w.description || '');
    const fine = isFinesse(w.name, w.description || '');
    const twoHanded = isTwoHanded(w.name, w.description || '');
    const ability = fine || isRange ? 'DEX' : 'STR';
    const abilityMod = mod(scores[ability.toLowerCase()] || 10);
    const attackBonus = prof + abilityMod;

    await db.insert(characterAttacks).values({
      characterSheetId: characterId,
      name: w.name,
      attackBonus,
      damage: null,
      damageType: null,
      abilityUsed: ability,
      actionType: 'action',
      rangeType: isRange ? 'ranged' : 'melee',
      isMagical: w.magic,
      sourceType: 'inventory',
      sourceItemId: w.id,
    });
    created++;
  }

  const allAttacks = await db.select().from(characterAttacks).where(eq(characterAttacks.characterSheetId, characterId));
  return json({ created, attacks: allAttacks });
};
