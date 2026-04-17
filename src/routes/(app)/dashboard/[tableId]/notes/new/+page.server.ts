import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createSessionNote, getSessionLabels, createActivityLog } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params }) => {
  const labels = await getSessionLabels(params.tableId);
  return { labels };
};

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const session = locals.session;
    if (!session?.user?.id) return fail(401, { error: 'Unauthorized' });

    const form = await request.formData();
    const title = form.get('title') as string;
    const body = form.get('body') as string;
    const sessionLabel = (form.get('sessionLabel') as string) || undefined;
    const visibility = (form.get('visibility') as string) || 'table';
    const actionType = form.get('action') as string;

    if (actionType === 'write') {
      if (!title?.trim()) return fail(400, { error: 'Title is required.' });
      if (!body?.trim()) return fail(400, { error: 'Body is required.' });

      const note = await createSessionNote({
        tableId: params.tableId,
        authorUserId: session.user.id,
        title: title.trim(),
        body: body.trim(),
        sourceType: 'in_app',
        sessionLabel: sessionLabel?.trim() || undefined,
        visibility,
      });

      await createActivityLog({
        tableId: params.tableId,
        actorUserId: session.user.id,
        eventType: 'note_uploaded',
        objectType: 'session_note',
        objectId: note.id,
        summary: `Created note "${note.title}"`,
      });

      throw redirect(303, `/dashboard/${params.tableId}/notes/${note.id}`);
    }

    return fail(400, { error: 'Invalid action' });
  }
};
