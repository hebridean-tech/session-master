import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTableRole, updateSessionNote } from '$lib/db/queries';

export const PUT: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { noteId, tableId, title, body: noteBody, sessionLabel, visibility } = body;
  if (!noteId) return json({ error: 'Missing noteId' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role) return json({ error: 'Forbidden' }, { status: 403 });

  try {
    await updateSessionNote(noteId, {
      title: title || undefined,
      body: noteBody || undefined,
      sessionLabel: sessionLabel || null,
      visibility: visibility || 'table',
    });
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Update failed' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const noteId = url.searchParams.get('noteId');
  const tableId = url.searchParams.get('tableId');
  if (!noteId || !tableId) return json({ error: 'Missing parameters' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role) return json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { deleteSessionNote, createActivityLog } = await import('$lib/db/queries');
    const { getSessionNoteById } = await import('$lib/db/queries');
    const row = await getSessionNoteById(noteId);
    await deleteSessionNote(noteId);
    await createActivityLog({
      tableId,
      actorUserId: session.user.id,
      eventType: 'note_deleted',
      objectType: 'session_note',
      objectId: noteId,
      summary: `Deleted note "${row?.note?.title || noteId}"`,
    });
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Delete failed' }, { status: 500 });
  }
};
