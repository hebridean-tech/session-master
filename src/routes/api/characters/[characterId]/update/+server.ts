import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { characterSheets, characterClasses, characterSpells, inventoryItems, characterCurrency } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserTableRole, createCharacterClasses } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals, params }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { tableId, data } = await request.json();
  if (!tableId || !data) return json({ error: 'Missing fields' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role) return json({ error: 'Forbidden' }, { status: 403 });

  const characterId = params.characterId;
  if (!characterId) return json({ error: 'Missing characterId' }, { status: 400 });

  const abilityScoresJson = data.abilityScores || null;

  await db.update(characterSheets).set({
    characterName: data.characterName || undefined,
    characterClass: data.characterClass || undefined,
    subclass: data.subclass || null,
    level: data.level || 1,
    ancestryOrSpecies: data.ancestryOrSpecies || undefined,
    background: data.background || null,
    alignment: data.alignment || null,
    ac: data.ac ?? null,
    hpMax: data.hpMax ?? null,
    hpCurrent: data.hpCurrent ?? null,
    speed: data.speed ?? null,
    proficiencyBonus: data.proficiencyBonus ?? 2,
    xp: data.xp ?? 0,
    abilityScoresJson: abilityScoresJson,
    skillProficienciesJson: data.skillProficiencies || [],
    toolProficienciesJson: data.toolProficiencies || [],
    languagesJson: data.languages || [],
    personalityTraits: data.personalityTraits || null,
    ideals: data.ideals || null,
    bonds: data.bonds || null,
    flaws: data.flaws || null,
    backstory: data.backstory || null,
  }).where(eq(characterSheets.id, characterId));

  // Update multi-class entries if provided
  if (data.classes && Array.isArray(data.classes) && data.classes.length > 0) {
    // Delete existing class entries and recreate
    await db.delete(characterClasses).where(eq(characterClasses.characterSheetId, characterId));
    await createCharacterClasses(characterId, data.classes);
  }

  // Update spells — replace all
  if (data.spells && Array.isArray(data.spells)) {
    await db.delete(characterSpells).where(eq(characterSpells.characterSheetId, characterId));
    for (const spell of data.spells.slice(0, 50)) {
      await db.insert(characterSpells).values({
        characterSheetId: characterId,
        name: spell.name,
        level: spell.level ?? 0,
        school: spell.school || null,
        prepared: !!spell.prepared,
        source: spell.source || 'class_feature',
        castingTime: 'action',
      });
    }
  }

  // Update inventory — replace all
  if (data.inventory && Array.isArray(data.inventory)) {
    await db.delete(inventoryItems).where(eq(inventoryItems.characterSheetId, characterId));
    for (const item of data.inventory.slice(0, 100)) {
      await db.insert(inventoryItems).values({
        characterSheetId: characterId,
        name: item.name,
        quantity: item.quantity || 1,
        weight: item.weight != null ? String(item.weight) : null,
        itemType: item.isMagic ? 'magic' : 'mundane',
        magic: !!item.isMagic,
        description: item.notes || null,
      });
    }
  }

  // Update currency
  if (data.currency) {
    await db.insert(characterCurrency).values({
      characterSheetId: characterId,
      cp: data.currency.cp || 0,
      sp: data.currency.sp || 0,
      ep: data.currency.ep || 0,
      gp: data.currency.gp || 0,
      pp: data.currency.pp || 0,
    }).onConflictDoUpdate({
      target: characterCurrency.characterSheetId,
      set: {
        cp: data.currency.cp || 0,
        sp: data.currency.sp || 0,
        ep: data.currency.ep || 0,
        gp: data.currency.gp || 0,
        pp: data.currency.pp || 0,
      },
    });
  }

  return json({ success: true });
};
