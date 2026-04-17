import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAiJobsByTable } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    const session = locals.session;
    if (!session?.user?.id) throw redirect(302, '/login');
    const pd = await parent();
    if (pd.role !== 'dm') throw redirect(302, `/dashboard/${params.tableId}`);
    const jobs = await getAiJobsByTable(params.tableId);
    return { tableId: params.tableId, jobs };
  }
