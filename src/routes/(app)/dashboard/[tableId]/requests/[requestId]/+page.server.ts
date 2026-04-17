import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createComment, getRequestById, createActivityLog, updateRequest, allocateTimeToRequest, createDiceRoll, getCommentsByRequest, getDiceRollsByRequest, getTimeAllocationByRequest, getSuggestionsByRequest, getAiSettings, getTimeWindowsByTable } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params, parent }) => {
    const pd = await parent();
    const req = await getRequestById(params.requestId);
    if (!req) throw redirect(302, `/dashboard/${params.tableId}/requests`);
    const comments = await getCommentsByRequest(params.requestId);
    const diceRolls = await getDiceRollsByRequest(params.requestId);
    const timeAllocation = await getTimeAllocationByRequest(params.requestId);
    const suggestions = await getSuggestionsByRequest(params.requestId);
    const aiSettings = await getAiSettings(params.tableId);
    const timeWindows = await getTimeWindowsByTable(params.tableId);
    return {
      request: req.request,
      user: req.user,
      sheet: req.sheet,
      userId: pd.userId,
      comments,
      diceRolls,
      timeAllocation,
      suggestions,
      aiSettings,
      timeWindows,
    };
  };

export const actions: Actions = {
    comment: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');

      const form = await request.formData();
      const body = form.get('body') as string;
      if (!body?.trim()) return fail(400, { error: 'Comment cannot be empty.' });

      const comment = await createComment({
        requestId: params.requestId,
        authorUserId: session.user.id,
        body: body.trim(),
        isDmOnly: form.get('isDmOnly') === 'on',
      });

      const req = await getRequestById(params.requestId);
      if (req) {
        await createActivityLog({
          tableId: req.request.tableId,
          actorUserId: session.user.id,
          eventType: 'comment_added',
          objectType: 'request',
          objectId: params.requestId,
          summary: `Comment added on "${req.request.title}"`,
        });
      }

      throw redirect(302, `/dashboard/${params.tableId}/requests/${params.requestId}`);
    },

    submit: async ({ params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');
      const req = await getRequestById(params.requestId);
      if (req) {
        await createActivityLog({
          tableId: req.request.tableId,
          actorUserId: session.user.id,
          eventType: 'status_changed',
          objectType: 'request',
          objectId: params.requestId,
          summary: `"${req.request.title}" submitted for review`,
        });
      }
      await updateRequest(params.requestId, { status: 'submitted', submittedAt: new Date() });
      throw redirect(302, `/dashboard/${params.tableId}/requests/${params.requestId}`);
    },

    approve: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');

      const form = await request.formData();
      const outcomeSummary = form.get('outcomeSummary') as string;
      const approvedTimeDays = form.get('approvedTimeDays') as string;
      const goldCostApproved = form.get('goldCostApproved') as string;
      const dmRuling = form.get('dmRuling') as string;
      const consequences = form.get('consequences') as string;
      const xpAwarded = form.get('xpAwarded') as string;
      const timeWindowId = form.get('timeWindowId') as string;

      const updateData: Record<string, unknown> = {
        status: 'approved',
        outcomeSummary: outcomeSummary?.trim() || null,
        dmRuling: dmRuling?.trim() || null,
        approvedTimeDays: approvedTimeDays ? parseInt(approvedTimeDays, 10) : null,
        goldCostApproved: goldCostApproved ? parseInt(goldCostApproved, 10) : null,
      };

      if (consequences?.trim()) updateData.dmRuling = (dmRuling?.trim() ? dmRuling.trim() + '\n\n' : '') + `Complications: ${consequences.trim()}`;
      if (xpAwarded) updateData.dmRuling = (dmRuling?.trim() ? dmRuling.trim() + '\n\n' : '') + `XP Awarded: ${xpAwarded}`;

      await updateRequest(params.requestId, updateData);

      // Time allocation
      const req = await getRequestById(params.requestId);
      if (timeWindowId && req) {
        const days = (updateData.approvedTimeDays as number) || (req.request.requestedTimeDays as number) || 0;
        if (days > 0) {
          await allocateTimeToRequest({
            requestId: params.requestId,
            timeWindowId,
            daysAllocated: days as number,
          });
        }
      }

      if (req) {
        await createActivityLog({
          tableId: req.request.tableId,
          actorUserId: session.user.id,
          eventType: 'status_changed',
          objectType: 'request',
          objectId: params.requestId,
          summary: `"${req.request.title}" approved`,
        });
      }

      throw redirect(302, `/dashboard/${params.tableId}/requests/${params.requestId}`);
    },

    request_changes: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');

      const form = await request.formData();
      const dmRuling = form.get('dmRuling') as string;

      await updateRequest(params.requestId, {
        status: 'needs_changes',
        dmRuling: dmRuling?.trim() || null,
      });

      const req = await getRequestById(params.requestId);
      if (req) {
        await createActivityLog({
          tableId: req.request.tableId,
          actorUserId: session.user.id,
          eventType: 'status_changed',
          objectType: 'request',
          objectId: params.requestId,
          summary: `"${req.request.title}" denied, changes requested`,
        });
      }

      throw redirect(302, `/dashboard/${params.tableId}/requests/${params.requestId}`);
    },

    resolve: async ({ params, locals }) => {
      const session = locals.session;
      const req = await getRequestById(params.requestId);
      await updateRequest(params.requestId, { status: 'resolved', resolvedAt: new Date() });

      if (req) {
        await createActivityLog({
          tableId: req.request.tableId,
          actorUserId: session?.user?.id,
          eventType: 'request_resolved',
          objectType: 'request',
          objectId: params.requestId,
          summary: `"${req.request.title}" resolved`,
        });
      }

      throw redirect(302, `/dashboard/${params.tableId}/requests/${params.requestId}`);
    },

    diceRoll: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');

      const form = await request.formData();
      const rollType = form.get('rollType') as string;
      const diceExpression = form.get('diceExpression') as string;
      const modifier = parseInt(form.get('modifier') as string || '0', 10);
      const resultJson = form.get('resultJson') as string;
      const visibleToPlayers = form.get('visibleToPlayers') !== 'false';
      const parsedResult = JSON.parse(resultJson);

      const req = await getRequestById(params.requestId);

      await createDiceRoll({
        requestId: params.requestId,
        createdByUserId: session.user.id,
        rollType,
        diceExpression,
        modifierJson: modifier || null,
        resultJson: parsedResult,
        visibleToPlayers,
      });

      if (req) {
        await createActivityLog({
          tableId: req.request.tableId,
          actorUserId: session.user.id,
          eventType: 'dice_rolled',
          objectType: 'request',
          objectId: params.requestId,
          summary: `${session.user?.id ? 'DM' : 'User'} rolled ${diceExpression} on "${req.request.title}"`,
          metadataJson: { rollType, diceExpression, resultJson: parsedResult, visibleToPlayers },
        });
      }

      throw redirect(302, `/dashboard/${params.tableId}/requests/${params.requestId}`);
    },
  };
