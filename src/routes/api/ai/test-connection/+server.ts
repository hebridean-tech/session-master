import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTableRole, getAiSettings } from '$lib/db/queries';
import { testConnection } from '$lib/ai/provider';
import type { AiProviderConfig } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { tableId, providerType, endpointUrl, modelName, apiKey } = body;
  if (!tableId || !providerType) return json({ error: 'Missing tableId or providerType' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'Forbidden' }, { status: 403 });

  const config: AiProviderConfig = {
    providerType: providerType as AiProviderConfig['providerType'],
    endpointUrl: endpointUrl || null,
    modelName: modelName || null,
    apiKey: apiKey || null,
  };

  const result = await testConnection(config);
  return json(result);
};
