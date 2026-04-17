import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { getTableById, getTableMembers } = await import('$lib/db/queries');
    console.log('[load tables/id] params.id:', params.id);
    const session = locals.session;
    const table = await getTableById(params.id);
    console.log('[load tables/id] table:', table?.id, table?.name);
    if (!table) return { table: null, members: [] };
    const members = await getTableMembers(params.id);
    return { table, members, userId: session?.user?.id };
  }
