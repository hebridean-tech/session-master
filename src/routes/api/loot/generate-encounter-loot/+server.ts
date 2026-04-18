import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callAi, type AiProviderConfig } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { tableId, enemyType, allowHomebrew, powerLevel, additionalInstructions } = body;
  if (!tableId || !enemyType) return json({ error: 'Missing tableId or enemyType' }, { status: 400 });

  const { getAiSettings, getCharacterSheetsByTable } = await import('$lib/db/queries');

  const aiConfig = await getAiSettings(tableId);
  if (!aiConfig) return json({ error: 'No AI configured for this table' }, { status: 400 });

  const providerConfig: AiProviderConfig = {
    providerType: (aiConfig.providerType as AiProviderConfig['providerType']) || 'hosted_api',
    hostedProvider: aiConfig.hostedProvider || null,
    endpointUrl: aiConfig.endpointUrl,
    modelName: aiConfig.modelName,
    apiKey: (aiConfig as any).apiKey ?? (aiConfig as any).apiKeyRef ?? null,
  };

  // Gather party context
  let partyContext = '';
  let avgLevel = 5;
  try {
    const rows = await getCharacterSheetsByTable(tableId);
    if (rows?.length) {
      avgLevel = Math.round(rows.reduce((s, r) => s + r.sheet.level, 0) / rows.length);
      partyContext = '\nParty members:\n' + rows.map(r => {
        const c = r.sheet;
        return `- ${c.characterName}: Level ${c.level} ${c.characterClass}${c.subclass ? ` (${c.subclass})` : ''}`;
      }).join('\n');
      partyContext += `\nAverage party level: ${avgLevel}`;
    }
  } catch {}

  const powerDescriptions: Record<string, string> = {
    middling: 'Standard loot — modest potions, common/uncommon items, small coin amounts. Useful but not exciting.',
    balanced: 'Expected D&D loot — a good mix of consumables, uncommon/rare items appropriate for the party level.',
    exciting: 'Generous loot — multiple uncommon/rare items, possibly one very rare, better coin haul. Memorable rewards.',
    overpowered: 'Excessive loot — rare+ items, legendary possibilities, large hoards. Use sparingly for boss fights.',
  };

  const powerDesc = powerDescriptions[powerLevel] || powerDescriptions.balanced;

  const systemPrompt = `You are a D&D 5e dungeon master assistant generating loot dropped by enemies after an encounter.
${allowHomebrew ? 'You may include homebrew/custom items — mark them with isHomebrew:true.' : 'Only use official D&D 5e items. Do not include homebrew items.'}
Power level: ${powerLevel}. ${powerDesc}
Generate loot that a CR-appropriate encounter with "${enemyType}" would plausibly carry or hoard.
Consider: would this creature hoard treasure? Would it carry weapons/armor? Would it have consumed potions?
Include currency (cp, sp, ep, gp, pp) as separate entries with item_type "currency".

Respond ONLY with a valid JSON array of objects. Each object must have:
- itemName (string) — for currency use format like "Gold Pieces", "Silver Pieces"
- itemType (string: weapon, armor, potion, wondrous, ring, scroll, wand, rod, staff, tool, gear, currency, other)
- rarity (string: common, uncommon, rare, very_rare, legendary, mundane)
- quantity (integer) — for currency, total value in that denomination
- valueGp (number, gp value per unit — for currency entries, set to the gp conversion rate: cp=0.01, sp=0.1, ep=0.5, gp=1, pp=10)
- description (string, brief description)
- isHomebrew (boolean)

Generate 5-15 items depending on power level. Be thematically appropriate for the enemy type.`;

  let userContent = `Generate encounter loot for: ${enemyType}${partyContext}`;
  if (additionalInstructions) userContent += `\n\nAdditional DM instructions: ${additionalInstructions}`;

  try {
    const response = await callAi(providerConfig, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ], { temperature: 0.8, maxTokens: 2500 });

    let items: any[];
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      items = JSON.parse(jsonMatch[0]);
    } else {
      items = JSON.parse(response.content);
    }

    return json({ items });
  } catch (e: any) {
    return json({ error: 'AI generation failed: ' + e.message }, { status: 500 });
  }
};
