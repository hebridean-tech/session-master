import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { characterSheets, inventoryItems, characterSpells, characterCurrency, spellSlots, characterClasses, user } from '$lib/db/schema';
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

  const { tableId, message } = await request.json();
  if (!tableId || !message) return json({ error: 'Missing fields' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  const settings = await getAiSettings(tableId);
  if (!settings || settings.permissionLevel < 1) {
    return json({ error: 'AI not configured for this table' }, { status: 400 });
  }

  // Gather full party data
  const sheets = await db.select({
    sheet: characterSheets,
    owner: { name: user.name, email: user.email, id: user.id },
  })
    .from(characterSheets)
    .innerJoin(user, eq(characterSheets.userId, user.id))
    .where(eq(characterSheets.tableId, tableId));

  const partyData: any[] = [];
  for (const { sheet, owner } of sheets) {
    const [inventory] = await Promise.all([
      db.select().from(inventoryItems).where(eq(inventoryItems.characterSheetId, sheet.id)),
    ]);
    const [spells] = await Promise.all([
      db.select().from(characterSpells).where(eq(characterSpells.characterSheetId, sheet.id)),
    ]);
    const [currency] = await Promise.all([
      db.select().from(characterCurrency).where(eq(characterCurrency.characterSheetId, sheet.id)),
    ]);
    const [slots] = await Promise.all([
      db.select().from(spellSlots).where(eq(spellSlots.characterSheetId, sheet.id)),
    ]);
    const [classes] = await Promise.all([
      db.select().from(characterClasses).where(eq(characterClasses.characterSheetId, sheet.id)),
    ]);

    partyData.push({
      name: sheet.characterName,
      owner: owner.name || owner.email,
      class: sheet.characterClass,
      subclass: sheet.subclass,
      level: sheet.level,
      classes: classes.length > 0 ? classes : null,
      hp: { max: sheet.hpMax, current: sheet.hpCurrent },
      ac: sheet.ac,
      abilityScores: sheet.abilityScoresJson,
      speed: sheet.speed,
      skills: sheet.skillProficienciesJson,
      languages: sheet.languagesJson,
      tools: sheet.toolProficienciesJson,
      personality: { traits: sheet.personalityTraits, ideals: sheet.ideals, bonds: sheet.bonds, flaws: sheet.flaws },
      backstory: sheet.backstory ? sheet.backstory.slice(0, 500) : null,
      inventory: inventory.map(i => ({ name: i.name, quantity: i.quantity, weight: i.weight, type: i.itemType, magic: i.magic, description: i.description })),
      spells: spells.map(s => ({ name: s.name, level: s.level, school: s.school, prepared: s.prepared, source: s.source })),
      spellSlots: slots.map(s => ({ level: s.level, current: s.current, max: s.max })),
      currency: currency.length > 0 ? currency[0] : null,
    });
  }

  const systemPrompt = `You are a DM Intelligence Assistant for a D&D campaign. You have full access to the party's character sheets, inventory, spells, currency, and more. You answer the DM's questions about the party accurately and helpfully.

RULES:
- Answer ONLY about what is in the party data provided. Do not invent items, spells, or stats.
- Be concise but thorough.
- If asked about magic items, list ALL magic items across ALL characters with who holds them.
- If asked about party composition, give a brief overview of each character.
- If asked to help plan encounters, base suggestions on actual party stats.
- The DM is the only one who sees your responses — be direct and tactical.

PARTY DATA:
${JSON.stringify(partyData, null, 2)}`;

  try {
    const result = await callAi(toProviderConfig(settings), [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ], { maxTokens: 4096, temperature: 0.3 });

    return json({ success: true, reply: result.content });
  } catch (e: any) {
    return json({ error: 'AI error: ' + e.message }, { status: 500 });
  }
};
