import { db } from '$lib/db';
import { characterSheets, characterClasses, characterClassFeatures, characterAttacks, characterSpells, spellSlots, combatResources } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterId } = params;

  const [sheet] = await db.select().from(characterSheets).where(eq(characterSheets.id, characterId)).limit(1);
  if (!sheet) return json({ error: 'Not found' }, { status: 404 });

  const scores = sheet.abilityScoresJson as Record<string, number> || {};
  function mod(s: number) { return Math.floor((s - 10) / 2); }

  const [features, attacks, spells, slots, resources, classEntries] = await Promise.all([
    db.select().from(characterClassFeatures).where(eq(characterClassFeatures.characterSheetId, characterId)),
    db.select().from(characterAttacks).where(eq(characterAttacks.characterSheetId, characterId)),
    db.select().from(characterSpells).where(eq(characterSpells.characterSheetId, characterId)),
    db.select().from(spellSlots).where(eq(spellSlots.characterSheetId, characterId)),
    db.select().from(combatResources).where(eq(combatResources.characterSheetId, characterId)),
    db.select().from(characterClasses).where(eq(characterClasses.characterSheetId, characterId)),
  ]);

  const passivePerception = 10 + (mod(scores.wis || 10) + (sheet.proficiencyBonus && (sheet.skillProficienciesJson as any)?.Perception ? sheet.proficiencyBonus : 0));

  return json({
    character: {
      id: sheet.id, name: sheet.characterName, class: sheet.characterClass,
      subclass: sheet.subclass, level: sheet.level, speed: sheet.speed,
      ac: sheet.ac, hpCurrent: sheet.hpCurrent, hpMax: sheet.hpMax,
      abilityScores: scores, proficiencyBonus: sheet.proficiencyBonus,
      classEntries: classEntries.length > 0 ? classEntries : [{
        id: null, characterSheetId: sheet.id, className: sheet.characterClass,
        subclass: sheet.subclass, classLevel: sheet.level, hitDie: 8, casterType: null, isPrimary: true,
      }],
    },
    features, attacks, spells, spellSlots: slots, resources,
    passivePerception,
  });
};
