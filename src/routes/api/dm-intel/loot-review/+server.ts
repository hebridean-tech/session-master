import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { sessionNotes, user, characterSheets } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
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

  const { tableId, sessionLabel } = await request.json();
  if (!tableId || !sessionLabel) return json({ error: 'Missing fields' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  const settings = await getAiSettings(tableId);
  if (!settings || settings.permissionLevel < 1) {
    return json({ error: 'AI not configured' }, { status: 400 });
  }

  // Fetch all notes for this session label
  const notes = await db.select({
    note: sessionNotes,
    authorName: user.name,
    authorEmail: user.email,
  })
    .from(sessionNotes)
    .innerJoin(user, eq(sessionNotes.authorUserId, user.id))
    .where(and(eq(sessionNotes.tableId, tableId), eq(sessionNotes.sessionLabel, sessionLabel)))
    .orderBy(desc(sessionNotes.createdAt));

  if (notes.length === 0) {
    return json({ error: `No notes found for session "${sessionLabel}"` }, { status: 404 });
  }

  // Fetch character names for reference
  const characters = await db.select({
    id: characterSheets.id,
    name: characterSheets.characterName,
    ownerName: user.name,
    ownerEmail: user.email,
  })
    .from(characterSheets)
    .innerJoin(user, eq(characterSheets.userId, user.id))
    .where(eq(characterSheets.tableId, tableId));

  const charList = characters.map(c => c.name).join(', ');

  const notesText = notes.map((n, i) =>
    `--- Note by ${n.authorName || n.authorEmail} ---\n${n.note.body}`
  ).join('\n\n');

  const result = await callAi(toProviderConfig(settings), [
    {
      role: 'system',
      content: `You are a D&D session loot analyst. Given session notes from multiple players for the same session, cross-reference them and extract:

1. A SUMMARY of key events (2-4 sentences)
2. LOOT GAINED: items found/received, listed by character name. Include quantities.
3. LOOT SPENT/MONEY SPENT: items sold, money paid, purchases made
4. LOOT LOST: items destroyed, stolen, or otherwise removed from the party

PARTY MEMBERS: ${charList}

IMPORTANT RULES:
- Match item recipients to character names from the party list above
- If a player mentions "I got X" or "we found X", attribute to that player's character
- Cross-reference between notes — if one player says "we found 200gp" and another says "I took the gold", attribute correctly
- Include quantities for everything
- If money was split, note how much each person got
- Be thorough — check every note for mentions of items, gold, rewards, purchases, sales

Return ONLY a JSON object:
{
  "summary": string,
  "lootGained": [
    { "characterName": string (must match a party member name exactly), "itemName": string, "quantity": number, "notes": string (brief context) }
  ],
  "moneyGained": [
    { "characterName": string, "amount": number, "currency": string ("cp"/"sp"/"ep"/"gp"/"pp"), "notes": string }
  ],
  "lootSpent": [
    { "characterName": string, "itemName": string, "cost": number, "costCurrency": string, "notes": string }
  ],
  "moneySpent": [
    { "characterName": string, "amount": number, "currency": string, "notes": string }
  ],
  "lootLost": [
    { "characterName": string, "itemName": string, "quantity": number, "reason": string }
  ]
}

If no items of a category were found, use an empty array [].
Return ONLY valid JSON, no markdown fences.`,
    },
    { role: 'user', content: `Session "${sessionLabel}" notes:\n\n${notesText}` },
  ], { maxTokens: 4096, temperature: 0.2 });

  let parsed: any;
  const cleaned = result.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return json({ error: 'AI returned invalid JSON', raw: result.content }, { status: 500 });
  }

  // Map character names to IDs for the frontend
  const charIdMap: Record<string, string> = {};
  for (const c of characters) {
    charIdMap[c.name] = c.id;
  }

  return json({
    success: true,
    sessionLabel,
    noteCount: notes.length,
    notesAuthors: notes.map(n => n.authorName || n.authorEmail),
    charIdMap,
    data: parsed,
  });
};
