import { db } from '$lib/db';
import { characterSpells } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const sheetId = url.searchParams.get('characterSheetId');
  if (!sheetId) return json({ error: 'Missing characterSheetId' }, { status: 400 });
  const spells = await db.select().from(characterSpells).where(eq(characterSpells.characterSheetId, sheetId));
  return json(spells);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const [spell] = await db.insert(characterSpells).values({
    characterSheetId: body.characterSheetId,
    name: body.name,
    level: body.level ?? 0,
    school: body.school || null,
    prepared: body.prepared ?? false,
    source: body.source || 'class_feature',
    description: body.description || null,
  }).returning();
  return json(spell, { status: 201 });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.id) return json({ error: 'Missing id' }, { status: 400 });
  await db.delete(characterSpells).where(and(eq(characterSpells.id, body.id), eq(characterSpells.characterSheetId, body.characterSheetId)));
  return json({ ok: true });
};
