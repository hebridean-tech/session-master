import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
    const { getTablesByUser } = await import('$lib/db/queries');
    try {
    const session = locals.session;
    if (!session?.user?.id) throw redirect(302, '/login');

    const userTables = (await getTablesByUser(session.user.id)) || [];
    return { tables: userTables };
    } catch (e) {
      if (e && typeof e === 'object' && 'status' in e) throw e;
      console.error('DASHBOARD LOAD ERROR:', e);
      throw e;
    }
  }
