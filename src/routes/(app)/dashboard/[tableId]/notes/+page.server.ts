import type { PageServerLoad } from './$types';
import { getSessionNotesByTable, getTableMembers, getSessionLabels, getAiSettings } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params, url, parent }) => {
    const { userId, role } = await parent();
    const notes = await getSessionNotesByTable(params.tableId, userId, role);
    const members = await getTableMembers(params.tableId);
    const labels = await getSessionLabels(params.tableId);
    const aiSettings = await getAiSettings(params.tableId);
    return { notes, members, labels, aiSettings };
  }
