import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { characterSheetId, targetUserId, tableId } = body;
  if (!characterSheetId || !targetUserId || !tableId) return json({ error: 'Missing fields' }, { status: 400 });

  // Only DM or current owner can transfer
  const { getUserTableRole } = await import('$lib/db/queries');
  const role = await getUserTableRole(locals.session.user.id, tableId);
  const isOwner = await (async () => {
    const { db } = await import('$lib/db');
    const { characterSheets } = await import('$lib/db/schema');
    const { eq, and } = await import('drizzle-orm');
    const [sheet] = await db.select({ userId: characterSheets.userId }).from(characterSheets)
      .where(and(eq(characterSheets.id, characterSheetId), eq(characterSheets.tableId, tableId))).limit(1);
    return sheet?.userId === locals.session!.user!.id;
  })();

  if (!role && !isOwner) return json({ error: 'Only DM or character owner can transfer' }, { status: 403 });

  // Target user must be a table member
  const { db } = await import('$lib/db');
  const { characterSheets, tableMembers } = await import('$lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const [membership] = await db.select().from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, targetUserId))).limit(1);
  if (!membership) return json({ error: 'Target user is not a member of this table' }, { status: 400 });

  const [updated] = await db.update(characterSheets)
    .set({ userId: targetUserId, updatedAt: new Date() })
    .where(eq(characterSheets.id, characterSheetId))
    .returning();

  return json({ success: true, character: updated });
};
