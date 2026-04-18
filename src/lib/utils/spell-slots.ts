/**
 * Multi-class spell slot calculation (PHB p.164)
 */

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

export interface ClassEntry {
  className: string;
  classLevel: number;
  casterType: string | null;
}

export interface MultiClassSpellSlots {
  /** Unified spell slots from full/half/third casters */
  unified: { level: number; max: number }[];
  /** Warlock pact magic slots (separate) */
  pact: { slots: number; level: number } | null;
}

/**
 * Calculate unified spell slots across multiple classes.
 * Warlock pact slots are tracked separately per PHB p.164.
 */
export function getMultiClassSpellSlots(classEntries: ClassEntry[]): MultiClassSpellSlots {
  let effectiveCasterLevel = 0;
  let warlockLevel = 0;

  for (const entry of classEntries) {
    const ct = entry.casterType;
    if (!ct || ct === 'warlock') {
      if (ct === 'warlock') warlockLevel += entry.classLevel;
      continue;
    }
    if (ct === 'full') {
      effectiveCasterLevel += entry.classLevel;
    } else if (ct === 'half') {
      effectiveCasterLevel += Math.floor(entry.classLevel / 2);
    } else if (ct === 'third') {
      effectiveCasterLevel += Math.floor((entry.classLevel + 2) / 3);
    }
  }

  effectiveCasterLevel = Math.min(effectiveCasterLevel, 20);

  const slots = FULL_CASTER_SLOTS[effectiveCasterLevel];
  const unified = slots
    ? slots.map((max, i) => ({ level: i + 1, max }))
    : [];

  const pact = warlockLevel > 0
    ? WARLOCK_PACT_SLOTS[warlockLevel] || null
    : null;

  return { unified, pact };
}

/**
 * Format a multi-class string like "Fighter 5 / Rogue 3"
 */
export function formatMultiClass(classEntries: ClassEntry[]): string {
  if (!classEntries.length) return '';
  // Sort: primary first, then by level desc
  const sorted = [...classEntries].sort((a, b) => b.classLevel - a.classLevel);
  return sorted.map(e => `${e.className} ${e.classLevel}`).join(' / ');
}
