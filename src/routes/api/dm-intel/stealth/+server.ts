import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { characterSheets, inventoryItems, characterCurrency, user } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAiSettings, getUserTableRole } from '$lib/db/queries';
import { callAi, type AiProviderConfig } from '$lib/ai/provider';

function toProviderConfig(settings: NonNullable<Awaited<ReturnType<typeof getAiSettings>>>): AiProviderConfig {
  return {
    providerType: settings.providerType as AiProviderConfig['providerType'],
    hostedProvider: settings.hostedProvider || null,
    endpointUrl: settings.endpointUrl,
    modelName: settings.modelName,
    apiKey: settings.apiKeyRef || null,
  };
}

export const POST: RequestHandler = async ({ request, locals, params }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { tableId, dieType, encounter } = await request.json();
  if (!tableId || !dieType) return json({ error: 'Missing fields' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  const settings = await getAiSettings(tableId);
  if (!settings || settings.permissionLevel < 1) {
    return json({ error: 'AI not configured for this table' }, { status: 400 });
  }

  // Gather all inventory across the party
  const sheets = await db.select({
    sheet: characterSheets,
    owner: { name: user.name, email: user.email, id: user.id },
  })
    .from(characterSheets)
    .innerJoin(user, eq(characterSheets.userId, user.id))
    .where(eq(characterSheets.tableId, tableId));

  // Build list of all items with owners
  const allItems: Array<{ name: string; owner: string; characterName: string; quantity: number; magic: boolean; description: string | null; currencyType?: string }> = [];
  for (const { sheet, owner } of sheets) {
    const inventory = await db.select().from(inventoryItems).where(eq(inventoryItems.characterSheetId, sheet.id));
    for (const item of inventory) {
      allItems.push({
        name: item.name,
        owner: owner.name || owner.email,
        characterName: sheet.characterName,
        quantity: item.quantity || 1,
        magic: !!item.magic,
        description: item.description,
      });
    }
    // Add currency as stealable targets
    const currency = await db.select().from(characterCurrency).where(eq(characterCurrency.characterSheetId, sheet.id));
    if (currency.length > 0) {
      const c = currency[0];
      if (c.pp > 0) allItems.push({ name: 'Platinum Pieces', owner: owner.name || owner.email, characterName: sheet.characterName, quantity: c.pp, magic: false, description: null, currencyType: 'pp' });
      if (c.gp > 0) allItems.push({ name: 'Gold Pieces', owner: owner.name || owner.email, characterName: sheet.characterName, quantity: c.gp, magic: false, description: null, currencyType: 'gp' });
      if (c.ep > 0) allItems.push({ name: 'Electrum Pieces', owner: owner.name || owner.email, characterName: sheet.characterName, quantity: c.ep, magic: false, description: null, currencyType: 'ep' });
      if (c.sp > 0) allItems.push({ name: 'Silver Pieces', owner: owner.name || owner.email, characterName: sheet.characterName, quantity: c.sp, magic: false, description: null, currencyType: 'sp' });
      if (c.cp > 0) allItems.push({ name: 'Copper Pieces', owner: owner.name || owner.email, characterName: sheet.characterName, quantity: c.cp, magic: false, description: null, currencyType: 'cp' });
    }
  }

  if (allItems.length === 0) {
    return json({ error: 'No items to target — the party has no inventory.' }, { status: 400 });
  }

  // Assign random numbers to each item using a seeded approach
  const maxRoll = parseInt(dieType.replace('d', '')) || 100;
  const itemMap = allItems.map((item, i) => ({
    ...item,
    rangeStart: (i * maxRoll) % allItems.length === i
      ? Math.floor((i / allItems.length) * maxRoll)
      : Math.floor(Math.random() * (maxRoll - 1)),
    rollValue: 0,
  }));

  // Actually assign non-overlapping ranges
  const rangeSize = Math.max(1, Math.floor(maxRoll / allItems.length));
  for (let i = 0; i < itemMap.length; i++) {
    itemMap[i].rangeStart = i * rangeSize + 1;
  }

  const result = await callAi(toProviderConfig(settings), [
    {
      role: 'system',
      content: `You are a D&D encounter narrator. A stealth encounter is happening against the party.

Given a list of party items with their assigned number ranges and a dice roll result, you narrate what happens:
- If the roll hits an item's range, describe what was stolen/attempted to be stolen in a dramatic D&D style
- Consider the item's value and whether it's magic (magic items are harder to steal, describe the attempt)
- Mention which character the item belongs to
- If the roll doesn't hit anything, describe a failed attempt
- Be brief (2-4 sentences), dramatic, and in character

ITEMS AND RANGES (d${maxRoll}):
${itemMap.map(i => `${i.rangeStart}-${Math.min(i.rangeStart + rangeSize - 1, maxRoll)}: ${i.name} (held by ${i.characterName}, qty ${i.quantity}${i.magic ? ', MAGIC' : ''})`).join('\n')}`,
    },
    {
      role: 'user',
      content: encounter
        ? `Encounter: ${encounter}\n\nDM's d${maxRoll} roll: [DM WILL ROLL]`
        : `DM's d${maxRoll} roll: [DM WILL ROLL]`,
    },
  ], { maxTokens: 512, temperature: 0.7 });

  // The AI can't roll dice — we send the item map to the client for the actual roll
  return json({
    success: true,
    items: itemMap.map(i => ({
      name: i.name,
      characterName: i.characterName,
      owner: i.owner,
      quantity: i.quantity,
      magic: i.magic,
      currencyType: i.currencyType || null,
      rangeStart: i.rangeStart,
      rangeEnd: Math.min(i.rangeStart + rangeSize - 1, maxRoll),
    })),
    maxRoll,
    totalItems: allItems.length,
  });
};
