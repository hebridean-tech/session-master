import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
    const { getCharacterSheetsByTable, getTableById } = await import('$lib/db/queries');
    const sheets = await getCharacterSheetsByTable(params.tableId);
    const table = await getTableById(params.tableId);
    return { sheets, partyLevel: table?.currentLevel ?? 1 };
  }
