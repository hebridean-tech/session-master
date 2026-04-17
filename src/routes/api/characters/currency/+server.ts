import { db } from '$lib/db';
import { characterCurrency } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const sheetId = url.searchParams.get('characterSheetId');
  if (!sheetId) return json({ error: 'Missing characterSheetId' }, { status: 400 });
  const rows = await db.select().from(characterCurrency).where(eq(characterCurrency.characterSheetId, sheetId));
  if (rows.length === 0) {
    const [created] = await db.insert(characterCurrency).values({ characterSheetId: sheetId }).returning();
    return json(created);
  }
  return json(rows[0]);
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.characterSheetId) return json({ error: 'Missing characterSheetId' }, { status: 400 });
  const existing = await db.select().from(characterCurrency).where(eq(characterCurrency.characterSheetId, body.characterSheetId));
  const data = { cp: body.cp ?? 0, sp: body.sp ?? 0, ep: body.ep ?? 0, gp: body.gp ?? 0, pp: body.pp ?? 0, updatedAt: new Date() };
  if (existing.length === 0) {
    const [row] = await db.insert(characterCurrency).values({ ...data, characterSheetId: body.characterSheetId }).returning();
    return json(row);
  }
  const [row] = await db.update(characterCurrency).set(data).where(eq(characterCurrency.characterSheetId, body.characterSheetId)).returning();
  return json(row);
};
