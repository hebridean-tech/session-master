import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { table, userId, role } = await parent();
  if (role !== 'dm') {
    return { table, userId, role, lootEntries: [], characters: [] };
  }

  const { getLootEntries, getCharacterSheetsByTable } = await import('$lib/db/queries');
  const [lootEntries, characters] = await Promise.all([
    getLootEntries(table.id),
    getCharacterSheetsByTable(table.id),
  ]);

  return { table, userId, role, lootEntries, characters };
};
