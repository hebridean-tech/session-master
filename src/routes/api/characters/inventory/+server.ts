import { db } from '$lib/db';
import { inventoryItems } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const sheetId = url.searchParams.get('characterSheetId');
  if (!sheetId) return json({ error: 'Missing characterSheetId' }, { status: 400 });
  const items = await db.select().from(inventoryItems).where(eq(inventoryItems.characterSheetId, sheetId));
  return json(items);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const [item] = await db.insert(inventoryItems).values({
    characterSheetId: body.characterSheetId,
    name: body.name,
    quantity: body.quantity ?? 1,
    itemType: body.itemType || 'misc',
    weight: body.weight != null ? body.weight : null,
    description: body.description || null,
    magic: body.magic ?? false,
    rarity: body.rarity || null,
    equipped: body.equipped ?? false,
  }).returning();
  return json(item, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.id) return json({ error: 'Missing id' }, { status: 400 });
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ['name','quantity','itemType','weight','description','magic','rarity','equipped','attuned']) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  const [item] = await db.update(inventoryItems).set(updates).where(eq(inventoryItems.id, body.id)).returning();
  return json(item);
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.id) return json({ error: 'Missing id' }, { status: 400 });
  await db.delete(inventoryItems).where(and(eq(inventoryItems.id, body.id), eq(inventoryItems.characterSheetId, body.characterSheetId)));
  return json({ ok: true });
};
