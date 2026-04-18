import { db } from '$lib/db';
import { characterClassFeatures } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const updates: any = { updatedAt: new Date() };
  for (const key of ['name','description','actionType','resourceType','resourceMax','resourceCurrent','damage','damageType','tags','displayOrder']) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  const [updated] = await db.update(characterClassFeatures).set(updates)
    .where(and(eq(characterClassFeatures.id, params.featureId), eq(characterClassFeatures.characterSheetId, params.characterId)))
    .returning();
  return json(updated);
};
