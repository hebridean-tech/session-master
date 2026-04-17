import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
    const { getRequestsByTable } = await import('$lib/db/queries');
    const status = url.searchParams.get('status') || 'all';
    const requests = await getRequestsByTable(params.tableId, status);
    return { requests, status };
  }
