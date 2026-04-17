import { db } from '$lib/db';
import { spellSlots } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const sheetId = url.searchParams.get('characterSheetId');
  if (!sheetId) return json({ error: 'Missing characterSheetId' }, { status: 400 });
  const slots = await db.select().from(spellSlots).where(eq(spellSlots.characterSheetId, sheetId));
  return json(slots);
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.characterSheetId) return json({ error: 'Missing characterSheetId' }, { status: 400 });
  // Upsert each slot entry
  const results = [];
  for (const slot of (body.slots || [])) {
    const existing = await db.select().from(spellSlots).where(
      and(eq(spellSlots.characterSheetId, body.characterSheetId), eq(spellSlots.level, slot.level))
    );
    if (existing.length > 0) {
      const [updated] = await db.update(spellSlots)
        .set({ current: slot.current, max: slot.max, updatedAt: new Date() })
        .where(eq(spellSlots.id, existing[0].id))
        .returning();
      results.push(updated);
    } else {
      const [inserted] = await db.insert(spellSlots)
        .values({ characterSheetId: body.characterSheetId, level: slot.level, current: slot.current, max: slot.max })
        .returning();
      results.push(inserted);
    }
  }
  return json(results);
};
