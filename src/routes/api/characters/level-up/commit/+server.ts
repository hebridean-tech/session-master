import { db } from '$lib/db';
import { characterSheets, characterClasses, spellSlots, characterClassFeatures, combatResources } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import classFeaturesData from '$lib/data/class-features.json';
import { parseFeatureActionType } from '$lib/utils/action-type';
import { getMultiClassSpellSlots } from '$lib/utils/spell-slots';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterSheetId, classEntryId, hpIncrease, abilityScoreImprovements, newSpellSlots, featuresToAddNotes, chosenFightingStyle, newClassName, newSubclass, newHitDie, newCasterType } = await request.json();
  if (!characterSheetId || hpIncrease == null) return json({ error: 'Missing fields' }, { status: 400 });

  const [sheet] = await db.select().from(characterSheets).where(eq(characterSheets.id, characterSheetId)).limit(1);
  if (!sheet) return json({ error: 'Character not found' }, { status: 404 });

  // Determine which class is being leveled up
  let targetClassName = sheet.characterClass;
  let targetSubclass = sheet.subclass;
  let newClassEntryId: string | null = null;

  if (classEntryId) {
    // Leveling an existing class
    const [classEntry] = await db.select().from(characterClasses)
      .where(eq(characterClasses.id, classEntryId)).limit(1);
    if (classEntry) {
      await db.update(characterClasses)
        .set({ classLevel: classEntry.classLevel + 1, updatedAt: new Date() })
        .where(eq(characterClasses.id, classEntry.id));
      targetClassName = classEntry.className;
      targetSubclass = classEntry.subclass;
    }
  } else if (newClassName && newHitDie) {
    // Adding a new class at level 1
    const [created] = await db.insert(characterClasses).values({
      characterSheetId, className: newClassName, subclass: newSubclass || null,
      classLevel: 1, hitDie: newHitDie, casterType: newCasterType || null, isPrimary: false,
    }).returning();
    newClassEntryId = created.id;
    targetClassName = newClassName;
    targetSubclass = newSubclass || null;
  } else {
    // Fallback: no classEntryId, no new class — use old columns
    // Also create a character_classes row if none exist
    const existing = await db.select().from(characterClasses)
      .where(eq(characterClasses.characterSheetId, characterSheetId));
    if (existing.length === 0) {
      // Legacy path: create from character_sheets columns
      const [created] = await db.insert(characterClasses).values({
        characterSheetId, className: sheet.characterClass, subclass: sheet.subclass,
        classLevel: newLevel, hitDie: 8, isPrimary: true,
      }).returning();
      newClassEntryId = created.id;
    }
  }

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

  // Recalculate multi-class spell slots
  const allClassEntries = await db.select().from(characterClasses)
    .where(eq(characterClasses.characterSheetId, characterSheetId));
  if (allClassEntries.length > 0 && newSpellSlots && Array.isArray(newSpellSlots)) {
    const slots = getMultiClassSpellSlots(allClassEntries);
    for (const slot of slots.unified) {
      if (slot.max <= 0) continue;
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
    // Warlock pact slots
    if (slots.pact) {
      const existing = await db.select().from(spellSlots).where(
        and(eq(spellSlots.characterSheetId, characterSheetId), eq(spellSlots.level, slots.pact.level))
      );
      if (existing.length > 0) {
        await db.update(spellSlots)
          .set({ max: slots.pact.slots, current: slots.pact.slots, updatedAt: new Date() })
          .where(eq(spellSlots.id, existing[0].id));
      } else {
        await db.insert(spellSlots)
          .values({ characterSheetId, level: slots.pact.level, current: slots.pact.slots, max: slots.pact.slots });
      }
    }
  } else if (newSpellSlots && Array.isArray(newSpellSlots)) {
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

  // Insert class features for the new level
  const className = (targetClassName || '').toLowerCase();
  const classData = (classFeaturesData as any)[className];
  if (classData?.features?.[String(newLevel)]) {
    const feats = classData.features[String(newLevel)];
    for (let i = 0; i < feats.length; i++) {
      const f = feats[i];
      const parsed = parseFeatureActionType(f.description || '');
      await db.insert(characterClassFeatures).values({
        characterSheetId,
        name: f.name,
        description: f.description || null,
        levelGained: newLevel,
        source: 'class',
        actionType: parsed.actionType,
        resourceType: parsed.resourceType,
        resourceMax: parsed.resourceMax,
        resourceCurrent: parsed.resourceMax,
        damage: parsed.damage,
        damageType: parsed.damageType,
        tags: parsed.tags,
        displayOrder: i,
      });
      // Auto-create combat resource if feature has one
      if (parsed.resourceType && parsed.resourceMax) {
        const existing = await db.select().from(combatResources).where(
          and(eq(combatResources.characterSheetId, characterSheetId), eq(combatResources.name, f.name))
        );
        if (existing.length === 0) {
          await db.insert(combatResources).values({
            characterSheetId, name: f.name,
            resourceType: parsed.resourceType,
            current: parsed.resourceMax, max: parsed.resourceMax,
            description: f.description || null,
          });
        } else {
          await db.update(combatResources)
            .set({ max: parsed.resourceMax, current: parsed.resourceMax, updatedAt: new Date() })
            .where(eq(combatResources.id, existing[0].id));
        }
      }
    }
  }

  // Subclass features
  if (targetSubclass && classData?.features?.subclasses?.[targetSubclass]?.[String(newLevel)]) {
    const subFeats = classData.features.subclasses[targetSubclass][String(newLevel)];
    for (let i = 0; i < subFeats.length; i++) {
      const f = subFeats[i];
      const parsed = parseFeatureActionType(f.description || '');
      await db.insert(characterClassFeatures).values({
        characterSheetId, name: f.name, description: f.description || null,
        levelGained: newLevel, source: 'subclass', actionType: parsed.actionType,
        resourceType: parsed.resourceType, resourceMax: parsed.resourceMax, resourceCurrent: parsed.resourceMax,
        damage: parsed.damage, damageType: parsed.damageType, tags: parsed.tags, displayOrder: i,
      });
    }
  }

  return json({ success: true, sheet: updated });
};
