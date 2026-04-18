/**
 * Backfill script: populate character_class_features and combat_resources
 * for all existing characters based on class-features.json.
 *
 * DO NOT auto-run. Execute manually:
 *   cd app && npx tsx src/scripts/backfill-features.ts
 */
import { db } from '$lib/db';
import { characterSheets, characterClasses, characterClassFeatures, combatResources } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import classFeaturesData from '$lib/data/class-features.json';
import { parseFeatureActionType } from '$lib/utils/action-type';

const HIT_DIE: Record<string, number> = {
  artificer: 8, bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  fighter: 10, paladin: 10, ranger: 10,
  barbarian: 12, bloodhunter: 12,
  sorcerer: 6, wizard: 6,
};

function getCasterType(className: string, subclass: string | null): 'full' | 'half' | 'third' | 'warlock' | null {
  const cls = className.toLowerCase();
  const sub = (subclass || '').toLowerCase();
  if (cls === 'fighter' && sub.includes('eldritch knight')) return 'third';
  if (cls === 'rogue' && sub.includes('arcane trickster')) return 'third';
  if (cls === 'fighter' || cls === 'rogue') return null;
  const classData = (classFeaturesData as any)[cls];
  return classData?.casterType || null;
}

async function main() {
  const sheets = await db.select().from(characterSheets);
  console.log(`Found ${sheets.length} character sheets to process.`);

  for (const sheet of sheets) {
    const className = (sheet.characterClass || '').toLowerCase();
    const classData = (classFeaturesData as any)[className];
    if (!classData?.features) {
      console.log(`  Skipping ${sheet.characterName}: no class data for "${className}"`);
      continue;
    }

    // Migrate to character_classes table (if not already done)
    const existingClasses = await db.select().from(characterClasses)
      .where(eq(characterClasses.characterSheetId, sheet.id));
    if (existingClasses.length === 0) {
      const hitDie = HIT_DIE[className] || 8;
      const casterType = getCasterType(sheet.characterClass || '', sheet.subclass || null);
      await db.insert(characterClasses).values({
        characterSheetId: sheet.id,
        className: sheet.characterClass,
        subclass: sheet.subclass || null,
        classLevel: sheet.level,
        hitDie,
        casterType,
        isPrimary: true,
      });
      console.log(`    Created character_classes row for ${sheet.characterName}.`);
    }

    // Check if already backfilled features
    const existing = await db.select().from(characterClassFeatures)
      .where(eq(characterClassFeatures.characterSheetId, sheet.id));
    if (existing.length > 0) {
      console.log(`  Skipping ${sheet.characterName}: already has ${existing.length} features`);
      continue;
    }

    console.log(`  Processing ${sheet.characterName} (${className} level ${sheet.level})...`);

    for (let lvl = 1; lvl <= sheet.level; lvl++) {
      // Class features
      const feats = classData.features[String(lvl)];
      if (feats) {
        for (let i = 0; i < feats.length; i++) {
          const f = feats[i];
          const parsed = parseFeatureActionType(f.description || '');
          await db.insert(characterClassFeatures).values({
            characterSheetId: sheet.id, name: f.name, description: f.description || null,
            levelGained: lvl, source: 'class', actionType: parsed.actionType,
            resourceType: parsed.resourceType, resourceMax: parsed.resourceMax, resourceCurrent: parsed.resourceMax,
            damage: parsed.damage, damageType: parsed.damageType, tags: parsed.tags, displayOrder: i,
          });
          if (parsed.resourceType && parsed.resourceMax) {
            const eRes = await db.select().from(combatResources).where(
              and(eq(combatResources.characterSheetId, sheet.id), eq(combatResources.name, f.name))
            );
            if (eRes.length === 0) {
              await db.insert(combatResources).values({
                characterSheetId: sheet.id, name: f.name, resourceType: parsed.resourceType,
                current: parsed.resourceMax, max: parsed.resourceMax, description: f.description || null,
              });
            }
          }
        }
      }

      // Subclass features
      if (sheet.subclass && classData.features?.subclasses?.[sheet.subclass]?.[String(lvl)]) {
        const subFeats = classData.features.subclasses[sheet.subclass][String(lvl)];
        for (let i = 0; i < subFeats.length; i++) {
          const f = subFeats[i];
          const parsed = parseFeatureActionType(f.description || '');
          await db.insert(characterClassFeatures).values({
            characterSheetId: sheet.id, name: f.name, description: f.description || null,
            levelGained: lvl, source: 'subclass', actionType: parsed.actionType,
            resourceType: parsed.resourceType, resourceMax: parsed.resourceMax, resourceCurrent: parsed.resourceMax,
            damage: parsed.damage, damageType: parsed.damageType, tags: parsed.tags, displayOrder: i,
          });
        }
      }
    }
    console.log(`    Done.`);
  }
  console.log('Backfill complete.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
