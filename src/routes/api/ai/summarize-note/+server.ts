import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { summarizeNote } from '$lib/ai/features';
import { getAiSettings } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { noteId, tableId } = await request.json();
  if (!noteId || !tableId) return json({ error: 'Missing noteId or tableId' }, { status: 400 });

  const settings = await getAiSettings(tableId);
  if (!settings) return json({ error: 'AI not configured for this table' }, { status: 400 });
  if (settings.permissionLevel < 1) return json({ error: 'AI permission level insufficient (need 1+)' }, { status: 400 });

  try {
    const result = await summarizeNote(noteId, tableId, session.user.id);
    return json({ success: true, summary: result.summary, jobId: result.jobId });
  } catch (e: any) {
    return json({ error: e.message || 'AI request failed' }, { status: 500 });
  }
};
