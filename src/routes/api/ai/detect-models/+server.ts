import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTableRole } from '$lib/db/queries';
import { detectModels } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { tableId, providerType, endpointUrl } = body;
  if (!tableId || !providerType) return json({ error: 'Missing required fields' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'Forbidden' }, { status: 403 });

  const models = await detectModels(providerType, endpointUrl);
  return json({ models });
};
