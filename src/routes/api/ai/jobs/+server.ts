import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTableRole, getAiJobsByTable } from '$lib/db/queries';

export const GET: RequestHandler = async ({ url, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const tableId = url.searchParams.get('tableId');
  if (!tableId) return json({ error: 'Missing tableId' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'Forbidden' }, { status: 403 });

  const jobs = await getAiJobsByTable(tableId);
  return json({ jobs });
};
