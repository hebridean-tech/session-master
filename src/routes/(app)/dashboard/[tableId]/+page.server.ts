import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { getUserTableRole, getTableMembers, getRequestsByTable, getActiveTimeWindow, getWindowUsedDays, getActivityLogByTable, getCharacterSheetsByTable, getTableById } = await import('$lib/db/queries');
    const session = locals.session;
    const members = await getTableMembers(params.tableId);
    const role = await getUserTableRole(session?.user?.id || '', params.tableId);
    const table = await getTableById(params.tableId);
    const characters = await getCharacterSheetsByTable(params.tableId);
    const isDm = role?.role === 'dm';

    let activeWindow = null;
    let remainingDays = 0;
    let consumingRequests = [];

    if (isDm) {
      const pending = await getRequestsByTable(params.tableId, 'submitted');
      activeWindow = await getActiveTimeWindow(params.tableId);
      if (activeWindow?.id) {
        const used = await getWindowUsedDays(activeWindow.id);
        remainingDays = Math.max(0, (activeWindow.inWorldDaysAvailable || 0) - used);
        // Get approved/resolved requests consuming time
        const approvedReqs = await getRequestsByTable(params.tableId, 'approved');
        const resolvedReqs = await getRequestsByTable(params.tableId, 'resolved');
        consumingRequests = [...approvedReqs, ...resolvedReqs].filter(r => r.request.approvedTimeDays);
        const recentActivity = await getActivityLogByTable(params.tableId);
        return { members, pendingCount: pending.length, activeWindow, remainingDays, consumingRequests, recentActivity, table, characters };
      }
    }

    const userReqs = await getRequestsByTable(params.tableId);
    const activeReqs = userReqs.filter(r => ['submitted', 'approved', 'needs_changes'].includes(r.request.status));

    const recentActivity = await getActivityLogByTable(params.tableId);
    return { members, pendingCount: isDm ? (await getRequestsByTable(params.tableId, 'submitted')).length : activeReqs.length, activeWindow, remainingDays, consumingRequests: [], recentActivity, table, characters };
  }
