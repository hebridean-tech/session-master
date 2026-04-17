import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    const { getTablesByUser } = await import('$lib/db/queries');
    const session = locals.session;
    if (!session?.user?.id) return { tables: [] };
    const tables = await getTablesByUser(session.user.id);
    return { tables };
  }
