import { db } from '$lib/db';
import { characterSheets, spellSlots } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterSheetId, hpIncrease, abilityScoreImprovements, newSpellSlots, featuresToAddNotes, chosenFightingStyle } = await request.json();
  if (!characterSheetId || hpIncrease == null) return json({ error: 'Missing fields' }, { status: 400 });

  const [sheet] = await db.select().from(characterSheets).where(eq(characterSheets.id, characterSheetId)).limit(1);
  if (!sheet) return json({ error: 'Character not found' }, { status: 404 });

  const newLevel = sheet.level + 1;
  const proficiencyBonus = Math.floor((newLevel - 1) / 4) + 2;

  let scores = { ...(sheet.abilityScoresJson as Record<string, number> || {}) };
  if (abilityScoreImprovements) {
    for (const [stat, bonus] of Object.entries(abilityScoreImprovements)) {
      if (typeof bonus === 'number' && scores[stat] != null) {
        scores[stat] = Math.min(20, scores[stat] + bonus);
      }
    }
  }

  // Build notes additions
  let notes = sheet.notes || '';
  const additions: string[] = [];

  if (chosenFightingStyle) {
    additions.push(`⚔️ Fighting Style: ${chosenFightingStyle} (gained at level ${newLevel})`);
  }

  if (featuresToAddNotes && Array.isArray(featuresToAddNotes)) {
    for (const f of featuresToAddNotes) {
      additions.push(`✨ ${f.name}: ${f.description}`);
    }
  }

  if (additions.length > 0) {
    const separator = '\n\n--- Level ${newLevel} Features ---\n';
    notes = (notes ? notes + '\n' : '') + separator + additions.join('\n\n');
  }

  const [updated] = await db.update(characterSheets)
    .set({
      level: newLevel,
      hpMax: (sheet.hpMax || 0) + hpIncrease,
      hpCurrent: (sheet.hpCurrent || 0) + hpIncrease,
      proficiencyBonus,
      abilityScoresJson: scores,
      notes: notes || null,
      updatedAt: new Date(),
    })
    .where(eq(characterSheets.id, characterSheetId))
    .returning();

  if (newSpellSlots && Array.isArray(newSpellSlots)) {
    for (const slot of newSpellSlots) {
      if (!slot.max || slot.max <= 0) continue;
      const existing = await db.select().from(spellSlots).where(
        and(eq(spellSlots.characterSheetId, characterSheetId), eq(spellSlots.level, slot.level))
      );
      if (existing.length > 0) {
        await db.update(spellSlots)
          .set({ max: slot.max, current: slot.max, updatedAt: new Date() })
          .where(eq(spellSlots.id, existing[0].id));
      } else {
        await db.insert(spellSlots)
          .values({ characterSheetId, level: slot.level, current: slot.max, max: slot.max });
      }
    }
  }

  return json({ success: true, sheet: updated });
};
