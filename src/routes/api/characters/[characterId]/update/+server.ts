import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { characterSheets, characterClasses, characterSpells, inventoryItems, characterCurrency } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserTableRole, createCharacterClasses } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals, params }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  let tableId: string, data: any;
  try {
    const body = await request.json();
    tableId = body.tableId;
    data = body.data;
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!tableId || !data) return json({ error: 'Missing fields' }, { status: 400 });

  try {
    const role = await getUserTableRole(session.user.id, tableId);
    if (!role) return json({ error: 'Forbidden' }, { status: 403 });

    const characterId = params.characterId;
    if (!characterId) return json({ error: 'Missing characterId' }, { status: 400 });

    // Build update object — only include fields that are present
    const updates: Record<string, any> = {};
    if (data.characterName) updates.characterName = data.characterName;
    if (data.characterClass) updates.characterClass = data.characterClass;
    updates.subclass = data.subclass || null;
    if (data.level) updates.level = data.level;
    if (data.ancestryOrSpecies) updates.ancestryOrSpecies = data.ancestryOrSpecies;
    if (data.background) updates.background = data.background;
    updates.alignment = data.alignment || null;
    if (data.ac != null) updates.ac = data.ac;
    if (data.hpMax != null) updates.hpMax = data.hpMax;
    if (data.hpCurrent != null) updates.hpCurrent = data.hpCurrent;
    if (data.speed != null) updates.speed = data.speed;
    if (data.proficiencyBonus) updates.proficiencyBonus = data.proficiencyBonus;
    if (data.xp != null) updates.xp = data.xp;
    if (data.abilityScores) updates.abilityScoresJson = data.abilityScores;
    if (data.skillProficiencies) updates.skillProficienciesJson = data.skillProficiencies;
    if (data.toolProficiencies) updates.toolProficienciesJson = data.toolProficiencies;
    if (data.languages) updates.languagesJson = data.languages;
    if (data.personalityTraits) updates.personalityTraits = data.personalityTraits;
    if (data.ideals) updates.ideals = data.ideals;
    if (data.bonds) updates.bonds = data.bonds;
    if (data.flaws) updates.flaws = data.flaws;
    if (data.backstory) updates.backstory = data.backstory;

    if (Object.keys(updates).length > 0) {
      await db.update(characterSheets).set(updates).where(eq(characterSheets.id, characterId));
    }

    // Update multi-class entries if provided
    if (data.classes && Array.isArray(data.classes) && data.classes.length > 0) {
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

    // Update spell slots
    if (data.spellSlots && Array.isArray(data.spellSlots)) {
      const { spellSlots } = await import('$lib/db/schema');
      await db.delete(spellSlots).where(eq(spellSlots.characterSheetId, characterId));
      for (const slot of data.spellSlots) {
        if (slot.level && slot.max > 0) {
          await db.insert(spellSlots).values({
            characterSheetId: characterId,
            level: slot.level,
            current: slot.max,
            max: slot.max,
          });
        }
      }
    }

    return json({ success: true });
  } catch (e: any) {
    console.error('[update character]', e);
    return json({ error: e.message || 'Database error' }, { status: 500 });
  }
};
