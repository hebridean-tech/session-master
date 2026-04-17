import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { updateRequest, createActivityLog, createDiceRoll, getRequestsByTable, getDiceRollsByRequest } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params, url, parent }) => {
    const pd = await parent();
    const status = url.searchParams.get('status') || 'submitted';
    const rawRequests = await getRequestsByTable(params.tableId, status === 'all' ? undefined : status);
    const requestsWithRolls = await Promise.all(rawRequests.map(async (r: any) => {
      const rolls = await getDiceRollsByRequest(r.request.id);
      return { ...r, requestId: r.request.id, rolls };
    }));
    return { requests: rawRequests, status, requestsWithRolls, requestId: '', rolls: [], timeWindows: [] };
  };

export const actions: Actions = {
    approve: async ({ request, params, locals }) => {
      const session = locals.session;
      const form = await request.formData();
      const id = form.get('requestId') as string;
      const note = form.get('dmNote') as string;

      const updateData: Record<string, unknown> = { status: 'approved' };
      if (note?.trim()) updateData.dmRuling = note.trim();
      await updateRequest(id, updateData);

      await createActivityLog({
        tableId: params.tableId,
        actorUserId: session?.user?.id,
        eventType: 'status_changed',
        objectType: 'request',
        objectId: id,
        summary: `Request approved via queue${note?.trim() ? `: ${note.trim()}` : ''}`,
      });

      throw redirect(302, `/dashboard/${params.tableId}/dm/queue?status=submitted`);
    },
    request_changes: async ({ request, params, locals }) => {
      const session = locals.session;
      const form = await request.formData();
      const id = form.get('requestId') as string;
      const note = form.get('dmNote') as string;

      const updateData: Record<string, unknown> = { status: 'needs_changes' };
      if (note?.trim()) updateData.dmRuling = note.trim();
      await updateRequest(id, updateData);

      await createActivityLog({
        tableId: params.tableId,
        actorUserId: session?.user?.id,
        eventType: 'status_changed',
        objectType: 'request',
        objectId: id,
        summary: `Request denied, changes requested via queue`,
      });

      throw redirect(302, `/dashboard/${params.tableId}/dm/queue?status=submitted`);
    },
    resolve: async ({ request, params, locals }) => {
      const session = locals.session;
      const form = await request.formData();
      const id = form.get('requestId') as string;
      await updateRequest(id, { status: 'resolved', resolvedAt: new Date() });

      await createActivityLog({
        tableId: params.tableId,
        actorUserId: session?.user?.id,
        eventType: 'request_resolved',
        objectType: 'request',
        objectId: id,
        summary: `Request resolved via queue`,
      });

      throw redirect(302, `/dashboard/${params.tableId}/dm/queue?status=approved`);
    },
    diceRoll: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');

      const form = await request.formData();
      const requestId = form.get('requestId') as string;
      const rollType = form.get('rollType') as string;
      const diceExpression = form.get('diceExpression') as string;
      const modifier = parseInt(form.get('modifier') as string || '0', 10);
      const resultJsonStr = form.get('resultJson') as string;
      const visibleToPlayers = form.get('visibleToPlayers') !== 'false';
      const parsedResult = JSON.parse(resultJsonStr);

      await createDiceRoll({
        requestId,
        createdByUserId: session.user.id,
        rollType,
        diceExpression,
        modifierJson: modifier || null,
        resultJson: parsedResult,
        visibleToPlayers,
      });

      await createActivityLog({
        tableId: params.tableId,
        actorUserId: session.user.id,
        eventType: 'dice_rolled',
        objectType: 'request',
        objectId: requestId,
        summary: `Rolled ${diceExpression} on request (DM Queue)`,
        metadataJson: { rollType, diceExpression, resultJson: parsedResult, visibleToPlayers },
      });

      throw redirect(302, `/dashboard/${params.tableId}/dm/queue?status=${new URL(request.url).searchParams.get('currentStatus') || 'submitted'}`);
    },
  };
