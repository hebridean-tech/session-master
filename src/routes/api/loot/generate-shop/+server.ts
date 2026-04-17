import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callAi } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { tableId, allowHomebrew, prompt } = body;
  if (!tableId) return json({ error: 'Missing tableId' }, { status: 400 });

  const { getAiSettings, getCharacterSheetsByTable, getSessionNotesByTable } = await import('$lib/db/queries');

  const aiConfig = await getAiSettings(tableId);
  if (!aiConfig) return json({ error: 'No AI configured for this table' }, { status: 400 });

  const providerConfig = {
    providerType: (aiConfig.providerType as any) || 'hosted_api',
    endpointUrl: aiConfig.endpointUrl,
    modelName: aiConfig.modelName,
    apiKey: (aiConfig as any).apiKey ?? (aiConfig as any).apiKeyRef ?? null,
  };

  // Gather context
  let partyContext = '';
  try {
    const rows = await getCharacterSheetsByTable(tableId);
    if (rows?.length) {
      partyContext = '\nParty members:\n' + rows.map(r => {
        const c = r.sheet;
        return `- ${c.characterName}: Level ${c.level} ${c.characterClass}${c.subclass ? ` (${c.subclass})` : ''}`;
      }).join('\n');
      const avgLevel = Math.round(rows.reduce((s, r) => s + r.sheet.level, 0) / rows.length);
      partyContext += `\nAverage party level: ${avgLevel}`;
    }
  } catch {}

  // Try to get DM plans for location info
  let locationContext = '';
  try {
    const { db } = await import('$lib/db');
    const { dmPlans } = await import('$lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const plans = await db.select().from(dmPlans).where(eq(dmPlans.tableId, tableId)).limit(3);
    if (plans?.length) {
      locationContext = '\nDM Plans / Locations:\n' + plans.map((p: any) =>
        `${p.title || 'Untitled'}: ${(p.content || '').substring(0, 300)}`
      ).join('\n---\n');
    }
  } catch {}

  // Try to get session notes
  let notesContext = '';
  try {
    const notes = await getSessionNotesByTable(tableId);
    if (notes?.length) {
      notesContext = '\nRecent session notes:\n' + notes.slice(0, 5).map((n: any) =>
        `- ${n.title || 'Note'}: ${(n.body || '').substring(0, 200)}`
      ).join('\n');
    }
  } catch {}

  // Try to load loot pool data
  let lootPoolContext = '';
  try {
    const fs = await import('fs');
    const path = await import('path');
    const lootPoolPath = path.join(process.cwd(), 'src/lib/data/loot-pool.json');
    if (fs.existsSync(lootPoolPath)) {
      const poolData = JSON.parse(fs.readFileSync(lootPoolPath, 'utf-8'));
      lootPoolContext = `\nLoot pool reference data available (${Array.isArray(poolData) ? poolData.length : 0} items).`;
    }
  } catch {}

  const systemPrompt = `You are a D&D 5e dungeon master assistant helping generate shop inventories.
Generate a list of items that would be available in a shop appropriate for the party's level and context.
${allowHomebrew ? 'You may include homebrew/custom items — mark them with isHomebrew:true.' : 'Only use official D&D 5e items. Do not include homebrew items.'}

Respond ONLY with a valid JSON array of objects. Each object must have:
- itemName (string)
- itemType (string: weapon, armor, potion, wondrous, ring, scroll, wand, rod, staff, tool, gear, other)
- rarity (string: common, uncommon, rare, very_rare, legendary, mundane)
- quantity (integer, default 1)
- valueGp (number, price in gold pieces)
- description (string, brief description of the item)
- isHomebrew (boolean)

Generate 6-12 items. Be creative with the shop's theme based on any location context provided.`;

  const userPrompt = prompt || `Generate a shop inventory for the party.${partyContext}${locationContext}${notesContext}`;

  try {
    const response = await callAi(providerConfig, [
      { role: 'system', content: systemPrompt + partyContext + locationContext + notesContext + lootPoolContext },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.8, maxTokens: 2000 });

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
