import { joinTableByCode } from '$lib/db/queries';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { code } = await request.json();
  if (!code) {
    return json({ error: 'Invite code required' }, { status: 400 });
  }

  const result = await joinTableByCode(session.user.id, code.toUpperCase());
  if (!result) {
    return json({ error: 'Invalid invite code' }, { status: 404 });
  }

  return json({ success: true, tableId: result.table.id });
};
