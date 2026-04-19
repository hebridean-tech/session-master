import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
    const { getCharacterSheetsByTable, getTableById, getTableMembers } = await import('$lib/db/queries');
    const parentData = await parent();
    const sheets = await getCharacterSheetsByTable(params.tableId);
    const table = await getTableById(params.tableId);
    const members = await getTableMembers(params.tableId);
    return { sheets, partyLevel: table?.currentLevel ?? 1, members, role: parentData.role };
  }
