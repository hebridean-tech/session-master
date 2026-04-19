import { db } from '$lib/db';
import { characterSheets, characterSpells, characterClasses } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { getAiSettings, getUserTableRole } from '$lib/db/queries';
import { callAi, type AiProviderConfig } from '$lib/ai/provider';
import type { RequestHandler } from './$types';

// D&D 5e spells known by class and level (index 1 = level 1, etc.)
// Format: { [level]: { cantripsKnown: n, spellsKnown: n, [optional level-specific fields] } }
const SPELLS_KNOWN: Record<string, Record<number, { cantripsKnown?: number; spellsKnown: number }>> = {
  bard: {
    1: { cantripsKnown: 2, spellsKnown: 4 }, 2: { spellsKnown: 5 }, 3: { spellsKnown: 6 }, 4: { spellsKnown: 7 },
    5: { spellsKnown: 8 }, 6: { spellsKnown: 9 }, 7: { spellsKnown: 10 }, 8: { spellsKnown: 11 },
    9: { spellsKnown: 12 }, 10: { cantripsKnown: 3, spellsKnown: 14 }, 11: { spellsKnown: 15 },
    12: { spellsKnown: 15 }, 13: { spellsKnown: 16 }, 14: { spellsKnown: 16 }, 15: { spellsKnown: 17 },
    16: { spellsKnown: 17 }, 17: { spellsKnown: 18 }, 18: { spellsKnown: 18 }, 19: { spellsKnown: 19 }, 20: { spellsKnown: 20 },
  },
  cleric: {
    1: { cantripsKnown: 3, spellsKnown: 5 }, 2: { spellsKnown: 6 }, 3: { spellsKnown: 8 },
    4: { spellsKnown: 10 }, 5: { spellsKnown: 12 }, 6: { spellsKnown: 14 }, 7: { spellsKnown: 15 },
    8: { spellsKnown: 16 }, 9: { spellsKnown: 17 }, 10: { cantripsKnown: 4, spellsKnown: 18 },
    11: { spellsKnown: 19 }, 12: { spellsKnown: 19 }, 13: { spellsKnown: 20 }, 14: { spellsKnown: 20 },
    15: { spellsKnown: 21 }, 16: { spellsKnown: 21 }, 17: { spellsKnown: 22 }, 18: { spellsKnown: 22 },
    19: { spellsKnown: 23 }, 20: { spellsKnown: 23 },
  },
  druid: {
    1: { cantripsKnown: 2, spellsKnown: 4 }, 2: { spellsKnown: 5 }, 3: { spellsKnown: 6 },
    4: { spellsKnown: 7 }, 5: { spellsKnown: 8 }, 6: { spellsKnown: 9 }, 7: { spellsKnown: 10 },
    8: { spellsKnown: 11 }, 9: { spellsKnown: 12 }, 10: { cantripsKnown: 3, spellsKnown: 14 },
    11: { spellsKnown: 15 }, 12: { spellsKnown: 15 }, 13: { spellsKnown: 16 }, 14: { spellsKnown: 16 },
    15: { spellsKnown: 17 }, 16: { spellsKnown: 17 }, 17: { spellsKnown: 18 }, 18: { spellsKnown: 18 },
    19: { spellsKnown: 19 }, 20: { spellsKnown: 19 },
  },
  sorcerer: {
    1: { cantripsKnown: 4, spellsKnown: 2 }, 2: { spellsKnown: 3 }, 3: { spellsKnown: 4 },
    4: { spellsKnown: 5 }, 5: { spellsKnown: 6 }, 6: { spellsKnown: 7 }, 7: { spellsKnown: 8 },
    8: { spellsKnown: 9 }, 9: { spellsKnown: 10 }, 10: { cantripsKnown: 5, spellsKnown: 11 },
    11: { spellsKnown: 12 }, 12: { spellsKnown: 12 }, 13: { spellsKnown: 13 }, 14: { spellsKnown: 13 },
    15: { spellsKnown: 14 }, 16: { spellsKnown: 14 }, 17: { spellsKnown: 15 }, 18: { spellsKnown: 15 },
    19: { spellsKnown: 15 }, 20: { spellsKnown: 15 },
  },
  warlock: {
    1: { cantripsKnown: 2, spellsKnown: 2 }, 2: { spellsKnown: 3 }, 3: { spellsKnown: 4 },
    4: { spellsKnown: 5 }, 5: { spellsKnown: 6 }, 6: { spellsKnown: 7 }, 7: { spellsKnown: 8 },
    8: { spellsKnown: 9 }, 9: { spellsKnown: 10 }, 10: { cantripsKnown: 3, spellsKnown: 10 },
    11: { spellsKnown: 11 }, 12: { spellsKnown: 11 }, 13: { spellsKnown: 12 }, 14: { spellsKnown: 12 },
    15: { spellsKnown: 13 }, 16: { spellsKnown: 13 }, 17: { spellsKnown: 14 }, 18: { spellsKnown: 14 },
    19: { spellsKnown: 15 }, 20: { spellsKnown: 15 },
  },
  wizard: {
    1: { cantripsKnown: 3, spellsKnown: 6 }, 2: { spellsKnown: 7 }, 3: { spellsKnown: 8 },
    4: { spellsKnown: 9 }, 5: { spellsKnown: 10 }, 6: { spellsKnown: 11 }, 7: { spellsKnown: 12 },
    8: { spellsKnown: 13 }, 9: { spellsKnown: 14 }, 10: { cantripsKnown: 4, spellsKnown: 15 },
    11: { spellsKnown: 16 }, 12: { spellsKnown: 16 }, 13: { spellsKnown: 17 }, 14: { spellsKnown: 17 },
    15: { spellsKnown: 18 }, 16: { spellsKnown: 18 }, 17: { spellsKnown: 19 }, 18: { spellsKnown: 19 },
    19: { spellsKnown: 20 }, 20: { spellsKnown: 20 },
  },
  artificer: {
    1: { cantripsKnown: 2, spellsKnown: 4 }, 2: { spellsKnown: 5 }, 3: { spellsKnown: 6 },
    4: { spellsKnown: 7 }, 5: { spellsKnown: 8 }, 6: { spellsKnown: 9 }, 7: { spellsKnown: 10 },
    8: { spellsKnown: 11 }, 9: { spellsKnown: 12 }, 10: { cantripsKnown: 3, spellsKnown: 14 },
    11: { spellsKnown: 15 }, 12: { spellsKnown: 15 }, 13: { spellsKnown: 16 }, 14: { spellsKnown: 16 },
    15: { spellsKnown: 17 }, 16: { spellsKnown: 17 }, 17: { spellsKnown: 18 }, 18: { spellsKnown: 18 },
    19: { spellsKnown: 19 }, 20: { spellsKnown: 19 },
  },
  // Half casters (paladin, ranger) get spells known too
  paladin: {
    2: { spellsKnown: 5 }, 3: { spellsKnown: 6 }, 4: { spellsKnown: 7 }, 5: { spellsKnown: 8 },
    6: { spellsKnown: 9 }, 7: { spellsKnown: 10 }, 8: { spellsKnown: 11 }, 9: { spellsKnown: 12 },
    10: { spellsKnown: 13 }, 11: { spellsKnown: 14 }, 12: { spellsKnown: 14 },
    13: { spellsKnown: 15 }, 14: { spellsKnown: 15 }, 15: { spellsKnown: 16 },
    16: { spellsKnown: 16 }, 17: { spellsKnown: 17 }, 18: { spellsKnown: 17 },
    19: { spellsKnown: 18 }, 20: { spellsKnown: 18 },
  },
  ranger: {
    2: { spellsKnown: 4 }, 3: { spellsKnown: 5 }, 4: { spellsKnown: 6 }, 5: { spellsKnown: 7 },
    6: { spellsKnown: 8 }, 7: { spellsKnown: 9 }, 8: { spellsKnown: 10 }, 9: { spellsKnown: 11 },
    10: { spellsKnown: 12 }, 11: { spellsKnown: 13 }, 12: { spellsKnown: 13 },
    13: { spellsKnown: 14 }, 14: { spellsKnown: 14 }, 15: { spellsKnown: 15 },
    16: { spellsKnown: 15 }, 17: { spellsKnown: 16 }, 18: { spellsKnown: 16 },
    19: { spellsKnown: 17 }, 20: { spellsKnown: 17 },
  },
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { characterSheetId, tableId } = await request.json();
  if (!characterSheetId || !tableId) return json({ error: 'Missing fields' }, { status: 400 });

  const role = await getUserTableRole(locals.session.user.id, tableId);
  if (!role) return json({ error: 'Forbidden' }, { status: 403 });

  const [sheet] = await db.select().from(characterSheets).where(eq(characterSheets.id, characterSheetId)).limit(1);
  if (!sheet) return json({ error: 'Character not found' }, { status: 404 });

  const settings = await getAiSettings(tableId);
  if (!settings?.aiEnabled) return json({ error: 'AI not enabled for this table' }, { status: 400 });

  // Get existing spells and class info
  const existingSpells = await db.select().from(characterSpells).where(eq(characterSpells.characterSheetId, characterSheetId));
  const classes = await db.select().from(characterClasses).where(eq(characterClasses.characterSheetId, characterSheetId));

  const existingNames = existingSpells.map(s => s.name);
  const classInfo = classes.map(c => `${c.className} ${c.classLevel}${c.subclass ? ` (${c.subclass})` : ''}`).join(', ');
  const casterTypes = [...new Set(classes.filter(c => c.casterType).map(c => c.casterType))].join(', ');
  const newLevel = sheet.level + 1;

  // Compute spells budget for prompt context
  let budgetContext = '';
  for (const cls of classes) {
    if (!cls.casterType) continue;
    const isLeveling = cls.className.toLowerCase() === (sheet.characterClass || '').toLowerCase();
    if (!isLeveling) continue;
    const table = SPELLS_KNOWN[cls.className.toLowerCase()];
    if (!table) continue;
    const oldD = table[cls.classLevel] || {};
    const newD = table[cls.classLevel + 1] || {};
    const cantrips = (newD.cantripsKnown || oldD.cantripsKnown || 0) - (oldD.cantripsKnown || 0);
    const spells = (newD.spellsKnown || 0) - (oldD.spellsKnown || 0);
 budgetContext = `This level up grants: ${cantrips > 0 ? cantrips + ' new cantrip(s) and ' : ''}${spells} new spell(s).`;

  const prompt = `You are a D&D 5e expert advisor helping a player choose spells upon leveling up.

Character:
- Name: ${sheet.characterName}
- Class(es): ${classInfo || sheet.characterClass + ' ' + sheet.level}
- Current Level: ${sheet.level} (leveling to ${newLevel})
- Caster Type(s): ${casterTypes || 'Unknown'}
- Ability Scores: ${JSON.stringify(sheet.abilityScoresJson)}

Spells Available at This Level Up: ${budgetContext || 'No spells-known table found for this class.'}

Existing Spells (${existingNames.length}): ${existingNames.join(', ') || 'None'}
${sheet.backstory ? `Backstory/Notes: ${sheet.backstory.substring(0, 500)}` : ''}

IMPORTANT: Generate a POOL of 10-15 good spell options for the player to choose from. The player knows exactly how many spells they can learn and will pick from your suggestions. Do NOT limit yourself to the exact number of new spells — give them options.

For each spell provide:
1. The official spell name
2. The spell level (0 for cantrip, 1-9)
3. The school of magic
4. A one-sentence reason why it fits this character's build AND playstyle
5. Whether it's a "must-have" (true/false) — priority picks

Rules:
- Do NOT recommend spells the character already knows (listed above)
- Only recommend spells at or below the max spell level for this class
- Prioritize spells that complement the character's class features and ability scores
- Include a mix of damage, control, utility, and buff spells where appropriate
- If the character has a subclass, recommend subclass-themed spells

Respond ONLY with a JSON array. No markdown. Format:
[{"name": "Spell Name", "level": 0, "school": "Evocation", "reason": "Why it fits", "mustHave": false}]`;

  try {
    const providerConfig: AiProviderConfig = {
      providerType: (settings.providerType as AiProviderConfig['providerType']) || 'hosted_api',
      hostedProvider: (settings.hostedProvider as string) || 'zai',
      endpointUrl: (settings.endpointUrl as string) || null,
      apiKey: (settings.apiKeyRef as string) || null,
      modelName: (settings.modelName as string) || null,
    };

    const result = await callAi(providerConfig, [{ role: 'user', content: prompt }]);
    let clean = result.content.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const spells = JSON.parse(clean);

    if (!Array.isArray(spells)) return json({ error: 'Invalid response' }, { status: 500 });
    return json({ spells });
  } catch (e: any) {
    return json({ error: e.message || 'AI request failed' }, { status: 500 });
  }
};

// Simplified version without require()
function getSpellsGainedAtLevelSimple(className: string, oldLevel: number, newLevel: number) {
  const cls = className.toLowerCase();
  const table = SPELLS_KNOWN[cls];
  if (!table) return { cantripsGained: 0, totalSpellsKnownOld: 0, totalSpellsKnownNew: 0, newSpellsAvailable: 0, maxSpellLevel: 9 };

  const oldData = table[oldLevel] || {};
  const newData = table[newLevel] || {};
  const cantripsGained = (newData.cantripsKnown || oldData.cantripsKnown || 0) - (oldData.cantripsKnown || 0);
  const totalSpellsKnownOld = oldData.spellsKnown || 0;
  const totalSpellsKnownNew = newData.spellsKnown || 0;
  const newSpellsAvailable = Math.max(0, totalSpellsKnownNew - totalSpellsKnownOld);

  let maxSpellLevel = 9;
  if (['paladin', 'ranger'].includes(cls)) maxSpellLevel = Math.min(5, Math.ceil(newLevel / 2));
  else if (cls === 'warlock') maxSpellLevel = Math.min(5, Math.ceil(newLevel / 2) + 1);
  else if (['fighter', 'rogue'].includes(cls)) maxSpellLevel = Math.min(4, Math.floor((newLevel + 2) / 3));

  return { cantripsGained, totalSpellsKnownOld, totalSpellsKnownNew, newSpellsAvailable, maxSpellLevel };
}
