import { db } from '$lib/db';
import { characterSheets, characterSpells, characterClasses } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { getAiSettings, getUserTableRole } from '$lib/db/queries';
import { callAi, type AiProviderConfig } from '$lib/ai/provider';
import type { RequestHandler } from './$types';

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

  // Determine new level (current + 1)
  const newLevel = sheet.level + 1;

  const prompt = `You are a D&D 5e expert advisor helping a player choose spells upon leveling up.

Character:
- Name: ${sheet.characterName}
- Class(es): ${classInfo || sheet.characterClass + ' ' + sheet.level}
- Current Level: ${sheet.level} (leveling to ${newLevel})
- Caster Type(s): ${casterTypes || 'Unknown'}
- Ability Scores: ${JSON.stringify(sheet.abilityScoresJson)}
- Existing Spells (${existingNames.length}): ${existingNames.join(', ') || 'None'}
${sheet.backstory ? `Backstory/Notes: ${sheet.backstory.substring(0, 500)}` : ''}

Recommend 8-12 spells this character should learn at level ${newLevel}. For each spell provide:
1. The official spell name
2. The spell level (0 for cantrip, 1-9)
3. The school of magic
4. A one-sentence reason why it fits this character's build AND playstyle
5. Whether it's a "must-have" (true/false) — priority picks

Rules:
- Do NOT recommend spells the character already knows (listed above)
- Focus on spells available at or below level ${newLevel}
- Prioritize spells that complement the character's class features and ability scores
- Consider both combat utility and roleplay/story potential
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
