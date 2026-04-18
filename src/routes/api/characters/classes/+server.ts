import { db } from '$lib/db';
import { characterClasses, characterSheets } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const characterSheetId = url.searchParams.get('characterSheetId');
  if (!characterSheetId) return json({ error: 'Missing characterSheetId' }, { status: 400 });

  const entries = await db.select().from(characterClasses)
    .where(eq(characterClasses.characterSheetId, characterSheetId));

  if (entries.length === 0) {
    // Fallback: read from character_sheets old columns
    const [sheet] = await db.select().from(characterSheets)
      .where(eq(characterSheets.id, characterSheetId)).limit(1);
    if (sheet) {
      return json([{
        id: null,
        characterSheetId: sheet.id,
        className: sheet.characterClass,
        subclass: sheet.subclass,
        classLevel: sheet.level,
        hitDie: 8,
        casterType: null,
        isPrimary: true,
      }]);
    }
  }

  return json(entries);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { characterSheetId, className, subclass, hitDie, casterType, isPrimary } = await request.json();
  if (!characterSheetId || !className || !hitDie) return json({ error: 'Missing fields' }, { status: 400 });

  const [created] = await db.insert(characterClasses).values({
    characterSheetId, className, subclass: subclass || null,
    hitDie, casterType: casterType || null, isPrimary: isPrimary ?? false,
  }).returning();

  return json(created);
};
