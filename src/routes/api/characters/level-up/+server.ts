import { db } from '$lib/db';
import { characterSheets } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import classFeatures from '$lib/data/class-features.json';

const HIT_DIE: Record<string, number> = {
  artificer: 8, bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  fighter: 10, paladin: 10, ranger: 10,
  barbarian: 12, bloodhunter: 12,
  sorcerer: 6, wizard: 6,
};

const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1:  [2,0,0,0,0,0,0,0,0],
  2:  [3,0,0,0,0,0,0,0,0],
  3:  [4,2,0,0,0,0,0,0,0],
  4:  [4,3,0,0,0,0,0,0,0],
  5:  [4,3,2,0,0,0,0,0,0],
  6:  [4,3,3,0,0,0,0,0,0],
  7:  [4,3,3,1,0,0,0,0,0],
  8:  [4,3,3,2,0,0,0,0,0],
  9:  [4,3,3,3,1,0,0,0,0],
  10: [4,3,3,3,2,0,0,0,0],
  11: [4,3,3,3,2,1,0,0,0],
  12: [4,3,3,3,2,1,0,0,0],
  13: [4,3,3,3,2,1,1,0,0],
  14: [4,3,3,3,2,1,1,0,0],
  15: [4,3,3,3,2,1,1,1,0],
  16: [4,3,3,3,2,1,1,1,0],
  17: [4,3,3,3,2,1,1,1,1],
  18: [4,3,3,3,3,1,1,1,1],
  19: [4,3,3,3,3,2,1,1,1],
  20: [4,3,3,3,3,2,2,1,1],
};

const WARLOCK_PACT_SLOTS: Record<number, { slots: number; level: number }> = {
  1: { slots: 1, level: 1 }, 2: { slots: 2, level: 1 }, 3: { slots: 2, level: 2 },
  4: { slots: 2, level: 2 }, 5: { slots: 2, level: 3 }, 6: { slots: 2, level: 3 },
  7: { slots: 2, level: 4 }, 8: { slots: 2, level: 4 }, 9: { slots: 2, level: 5 },
  10: { slots: 2, level: 5 }, 11: { slots: 3, level: 5 }, 12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 }, 14: { slots: 3, level: 5 }, 15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 }, 17: { slots: 4, level: 5 }, 18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 }, 20: { slots: 4, level: 5 },
};

// Determine effective caster type accounting for subclasses
function getCasterType(className: string, subclass: string | null): 'full' | 'half' | 'third' | 'warlock' | null {
  const cls = className.toLowerCase();
  const sub = (subclass || '').toLowerCase();

  // Eldritch Knight fighter and Arcane Trickster rogue are third casters
  if (cls === 'fighter' && sub.includes('eldritch knight')) return 'third';
  if (cls === 'rogue' && sub.includes('arcane trickster')) return 'third';
  // Base fighter/rogue without those subclasses are non-casters
  if (cls === 'fighter' || cls === 'rogue') return null;

  // Check class features data for the canonical caster type
  const classData = (classFeatures as any)[cls];
  if (!classData) return null;
  return classData.casterType || null;
}

function getNewSpellSlots(casterType: string, newLevel: number): { level: number; max: number }[] {
  if (casterType === 'full') {
    const slots = FULL_CASTER_SLOTS[newLevel];
    return slots ? slots.map((max, i) => ({ level: i + 1, max })) : [];
  }
  if (casterType === 'half') {
    const effectiveLevel = Math.ceil(newLevel / 2);
    const slots = FULL_CASTER_SLOTS[Math.min(effectiveLevel, 10)];
    return slots ? slots.slice(0, 5).map((max, i) => ({ level: i + 1, max })) : [];
  }
  if (casterType === 'third') {
    const effectiveLevel = Math.floor((newLevel + 2) / 3); // 3rd→1, 7th→3, 13th→5, 19th→7
    const effectiveLevelForTable = Math.min(effectiveLevel, 10);
    const slots = FULL_CASTER_SLOTS[effectiveLevelForTable];
    return slots ? slots.map((max, i) => ({ level: i + 1, max })) : [];
  }
  if (casterType === 'warlock') {
    const p = WARLOCK_PACT_SLOTS[newLevel];
    return p ? [{ level: p.level, max: p.slots }] : [];
  }
  return [];
}

function getClassFeatures(className: string, subclass: string | null, level: string) {
  const cls = className.toLowerCase();
  const classData = (classFeatures as any)[cls];
  if (!classData?.features) return { classFeatures: [], subclassFeatures: [] };

  const classFeats = classData.features[level] || [];
  const subclassFeats: any[] = [];

  if (subclass && classData.features.subclasses) {
    // Try to match subclass name
    const subKey = Object.keys(classData.features.subclasses).find(
      k => k.toLowerCase() === subclass.toLowerCase() || subclass.toLowerCase().includes(k.toLowerCase())
    );
    if (subKey) {
      const subData = classData.features.subclasses[subKey];
      subclassFeats.push(...(subData[level] || []));
    }
  }

  return { classFeatures: classFeats, subclassFeatures: subclassFeats };
}

function getFightingStyleOptions(className: string, subclass: string | null, level: string) {
  const cls = className.toLowerCase();
  const sub = (subclass || '').toLowerCase();
  const { classFeatures: cFeats, subclassFeatures: sFeats } = getClassFeatures(className, subclass, level);
  const allFeats = [...cFeats, ...sFeats];

  for (const f of allFeats) {
    if (f.type === 'fighting_style' && f.options) {
      return f.options as string[];
    }
  }
  return null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterSheetId, newLevel } = await request.json();
  if (!characterSheetId || !newLevel) return json({ error: 'Missing fields' }, { status: 400 });

  const [sheet] = await db.select().from(characterSheets).where(eq(characterSheets.id, characterSheetId)).limit(1);
  if (!sheet) return json({ error: 'Character not found' }, { status: 404 });
  if (sheet.level + 1 !== newLevel) return json({ error: 'Must level up one level at a time' }, { status: 400 });
  if (newLevel > 20) return json({ error: 'Max level is 20' }, { status: 400 });

  const cls = (sheet.characterClass || '').toLowerCase();
  const hitDie = HIT_DIE[cls] || 8;
  const scores = (sheet.abilityScoresJson || {}) as Record<string, number>;
  const conMod = Math.floor(((scores.con || 10) - 10) / 2);
  const proficiencyBonus = Math.floor((newLevel - 1) / 4) + 2;
  const avgHpIncrease = Math.ceil(hitDie / 2) + conMod;

  const casterType = getCasterType(sheet.characterClass || '', sheet.subclass || null);
  const newSpellSlots = casterType ? getNewSpellSlots(casterType, newLevel) : [];

  const hasAsi = [4, 8, 12, 16, 19].includes(newLevel);

  const features = getClassFeatures(sheet.characterClass || '', sheet.subclass || null, String(newLevel));
  const fightingStyleOptions = getFightingStyleOptions(sheet.characterClass || '', sheet.subclass || null, String(newLevel));

  return json({
    characterName: sheet.characterName,
    characterClass: sheet.characterClass,
    subclass: sheet.subclass,
    currentLevel: sheet.level,
    newLevel,
    hitDie,
    conMod,
    proficiencyBonus,
    avgHpIncrease,
    oldHpMax: sheet.hpMax || 0,
    abilityScores: scores,
    hasAsi,
    casterType,
    spellcaster: casterType !== null,
    newSpellSlots,
    newClassFeatures: features.classFeatures,
    newSubclassFeatures: features.subclassFeatures,
    fightingStyleOptions,
  });
};
