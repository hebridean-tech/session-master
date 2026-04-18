import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callAi, type AiProviderConfig } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { tableId, message, history } = body;
  if (!tableId || !message) return json({ error: 'Missing required fields' }, { status: 400 });

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

  // Gather context
  let partyContext = '';
  try {
    const rows = await getCharacterSheetsByTable(tableId);
    if (rows?.length) {
      partyContext = '\nParty:\n' + rows.map(r => {
        const c = r.sheet;
        return `- ${c.characterName}: Level ${c.level} ${c.characterClass}${c.subclass ? ` (${c.subclass})` : ''}`;
      }).join('\n');
    }
  } catch {}

  let dmPlansContext = '';
  try {
    const { db } = await import('$lib/db');
    const { dmPlans } = await import('$lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const plans = await db.select().from(dmPlans).where(eq(dmPlans.tableId, tableId)).limit(3);
    if (plans?.length) {
      dmPlansContext = '\nDM Plans:\n' + plans.map((p: any) =>
        `${p.title || 'Untitled'}: ${(p.content || '').substring(0, 300)}`
      ).join('\n');
    }
  } catch {}

  let lootPoolContext = '';
  try {
    const fs = await import('fs');
    const path = await import('path');
    const lootPoolPath = path.join(process.cwd(), 'src/lib/data/loot-pool.json');
    if (fs.existsSync(lootPoolPath)) {
      const poolData = JSON.parse(fs.readFileSync(lootPoolPath, 'utf-8'));
      lootPoolContext = `\nLoot pool data: ${JSON.stringify(poolData).substring(0, 3000)}`;
    }
  } catch {}

  const systemPrompt = `You are a D&D 5e expert assistant helping a Dungeon Master with loot, magic items, shops, treasure, and rewards.
You have knowledge of official D&D 5e items, their rarities, appropriate levels, and pricing.
Be concise but helpful. When suggesting items, include rarity and approximate value.${partyContext}${dmPlansContext}${lootPoolContext}`;

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (Array.isArray(history)) {
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role || 'user', content: msg.content });
    }
  }

  messages.push({ role: 'user', content: message });

  try {
    const response = await callAi(providerConfig, messages as any, { temperature: 0.7, maxTokens: 1500 });
    return json({ response: response.content });
  } catch (e: any) {
    return json({ error: 'AI error: ' + e.message }, { status: 500 });
  }
};
