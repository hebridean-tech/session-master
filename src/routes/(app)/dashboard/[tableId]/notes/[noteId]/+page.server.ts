import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createActivityLog, getAiSettings, getEntitiesBySource, getSessionNoteById, getSessionNoteFiles } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params, parent }) => {
    const { userId, role } = await parent();
    const row = await getSessionNoteById(params.noteId);
    if (!row) throw redirect(302, `/dashboard/${params.tableId}/notes`);
    if (row.note.visibility === 'dm_only' && role !== 'dm' && row.note.authorUserId !== userId) {
      throw redirect(302, `/dashboard/${params.tableId}/notes`);
    }
    const files = await getSessionNoteFiles(params.noteId);
    const aiSettings = await getAiSettings(params.tableId);
    const entities = await getEntitiesBySource('session_note', params.noteId);
    return { note: row.note, author: row.user, files, aiSettings, entities };
  }
