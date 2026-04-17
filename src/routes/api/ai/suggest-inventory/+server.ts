import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestInventoryChanges } from '$lib/ai/features';
import { getAiSettings } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId, tableId } = await request.json();
  if (!requestId || !tableId) return json({ error: 'Missing requestId or tableId' }, { status: 400 });

  const settings = await getAiSettings(tableId);
  if (!settings) return json({ error: 'AI not configured for this table' }, { status: 400 });
  if (settings.permissionLevel < 2) return json({ error: 'AI permission level insufficient (need 2+)' }, { status: 400 });

  try {
    const result = await suggestInventoryChanges(requestId, tableId, session.user.id);
    return json({ success: true, suggestions: result.suggestions, jobId: result.jobId });
  } catch (e: any) {
    return json({ error: e.message || 'AI request failed' }, { status: 500 });
  }
};
