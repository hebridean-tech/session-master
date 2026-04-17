import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { table, userId } = await parent();
  return { tableId: table.id, userId };
};
