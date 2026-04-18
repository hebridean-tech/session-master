import { db } from '$lib/db';
import { characterSheets, characterClassFeatures } from '$lib/db/schema';
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

  const scores = (sheet.abilityScoresJson || {}) as Record<string, number>;
  const features = await db.select().from(characterClassFeatures)
    .where(eq(characterClassFeatures.characterSheetId, characterSheetId));

  const featureNames = features.map(f => f.name).join(', ');
  const mod = (s: number) => Math.floor((s - 10) / 2);

  // Build character narrative context from notes/backstory
  const narrativeParts: string[] = [];
  if (sheet.personalityTraits) narrativeParts.push(`Personality: ${sheet.personalityTraits}`);
  if (sheet.ideals) narrativeParts.push(`Ideals: ${sheet.ideals}`);
  if (sheet.bonds) narrativeParts.push(`Bonds: ${sheet.bonds}`);
  if (sheet.flaws) narrativeParts.push(`Flaws: ${sheet.flaws}`);
  if (sheet.backstory) narrativeParts.push(`Backstory: ${sheet.backstory}`);
  if (sheet.notes) {
    // Truncate notes to avoid token bloat — take last 1500 chars
    const notes = sheet.notes.length > 1500 ? '...' + sheet.notes.slice(-1500) : sheet.notes;
    narrativeParts.push(`Session Notes: ${notes}`);
  }
  const narrativeContext = narrativeParts.length > 0 ? narrativeParts.join('\n') : 'No additional character details.';

  const prompt = `You are a D&D 5e expert advisor. A player is leveling up their character and choosing a feat.

Character:
- Name: ${sheet.characterName}
- Class: ${sheet.characterClass}${sheet.subclass ? ` (${sheet.subclass})` : ''}
- Current Level: ${sheet.level} (leveling to ${sheet.level + 1})
- Ability Scores: STR ${scores.str || 10} (${mod(scores.str || 10) >= 0 ? '+' : ''}${mod(scores.str || 10)}), DEX ${scores.dex || 10} (${mod(scores.dex || 10) >= 0 ? '+' : ''}${mod(scores.dex || 10)}), CON ${scores.con || 10} (${mod(scores.con || 10) >= 0 ? '+' : ''}${mod(scores.con || 10)}), INT ${scores.int || 10} (${mod(scores.int || 10) >= 0 ? '+' : ''}${mod(scores.int || 10)}), WIS ${scores.wis || 10} (${mod(scores.wis || 10) >= 0 ? '+' : ''}${mod(scores.wis || 10)}), CHA ${scores.cha || 10} (${mod(scores.cha || 10) >= 0 ? '+' : ''}${mod(scores.cha || 10)})
- Proficiency Bonus: +${sheet.proficiencyBonus || 2}
- Existing Features: ${featureNames || 'None'}
- HP: ${sheet.hpCurrent || 0}/${sheet.hpMax || 0}
- AC: ${sheet.ac || 'Unknown'}

Character Background & Playstyle:
${narrativeContext}

Recommend 5 feats that would work well for this character. For each feat provide:
1. The feat name (official PHB/Tasha/etc name)
2. A one-sentence reason why it synergizes with this build AND their playstyle
3. The primary ability score it uses or improves (if any)

Consider: weak saves that need shoring up, ability scores close to even numbers, class synergies, AND the character's personality and observed playstyle from their notes. Prioritize feats that solve actual problems for this specific character and match who they are in the story.

Respond ONLY with a JSON array of objects. No markdown, no explanation. Format:
[{"name": "Feat Name", "reason": "Why it fits their build AND personality", "stat": "STR/DEX/CON/INT/WIS/CHA/null"}]`;

  try {
    const providerConfig: AiProviderConfig = {
      providerType: (settings.providerType as AiProviderConfig['providerType']) || 'hosted_api',
      hostedProvider: (settings.hostedProvider as string) || 'zai',
      endpointUrl: (settings.endpointUrl as string) || null,
      apiKey: (settings.apiKeyRef as string) || null,
      modelName: (settings.modelName as string) || null,
    };

    const result = await callAi(providerConfig, [{ role: 'user', content: prompt }]);
    // Parse JSON from response — handle markdown wrapping
    let clean = result.content.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const feats = JSON.parse(clean);

    if (!Array.isArray(feats)) return json({ error: 'Invalid response' }, { status: 500 });
    return json({ feats });
  } catch (e: any) {
    return json({ error: e.message || 'AI request failed' }, { status: 500 });
  }
};
