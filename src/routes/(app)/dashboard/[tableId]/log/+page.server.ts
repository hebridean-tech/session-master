import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
    const { getActivityLogByTable, countActivityLogByTable, getTableMembers } = await import('$lib/db/queries');
    const page = Number(url.searchParams.get('page') || '1');
    const actorUserId = url.searchParams.get('actor') || undefined;
    const eventType = url.searchParams.get('event_type') || undefined;
    const dateFrom = url.searchParams.get('from') || undefined;
    const dateTo = url.searchParams.get('to') || undefined;

    const [entries, total, members] = await Promise.all([
      getActivityLogByTable(params.tableId, { actorUserId, eventType, dateFrom, dateTo, page, perPage: 25 }),
      countActivityLogByTable(params.tableId, { actorUserId, eventType, dateFrom, dateTo }),
      getTableMembers(params.tableId),
    ]);

    return { entries, total, page, actorUserId, eventType, dateFrom, dateTo, members };
  }
