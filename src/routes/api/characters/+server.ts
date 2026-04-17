import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTableRole, deleteCharacterSheet } from '$lib/db/queries';

export const DELETE: RequestHandler = async ({ url, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const characterId = url.searchParams.get('characterId');
  const tableId = url.searchParams.get('tableId');
  if (!characterId || !tableId) return json({ error: 'Missing parameters' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role) return json({ error: 'Forbidden' }, { status: 403 });

  try {
    await deleteCharacterSheet(characterId);
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
};
