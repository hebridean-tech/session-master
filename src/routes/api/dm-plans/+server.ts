import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTableRole, createDmPlan, updateDmPlan, deleteDmPlan } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { tableId, title, body: planBody, sessionLabel, tags } = body;
  if (!tableId || !title) return json({ error: 'Missing tableId or title' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    const plan = await createDmPlan({
      tableId,
      authorUserId: session.user.id,
      title,
      body: planBody || '',
      sessionLabel: sessionLabel || null,
      tags: tags || [],
    });
    return json({ success: true, plan });
  } catch (e: any) {
    return json({ error: e.message || 'Create failed' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { planId, tableId, title, body: planBody, sessionLabel, tags, sortOrder } = body;
  if (!planId || !tableId) return json({ error: 'Missing planId or tableId' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    const data: Record<string, any> = {};
    if (title !== undefined) data.title = title;
    if (planBody !== undefined) data.body = planBody;
    if (sessionLabel !== undefined) data.sessionLabel = sessionLabel || null;
    if (tags !== undefined) data.tags = tags;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    await updateDmPlan(planId, data);
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Update failed' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const planId = url.searchParams.get('planId');
  const tableId = url.searchParams.get('tableId');
  if (!planId || !tableId) return json({ error: 'Missing parameters' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    await deleteDmPlan(planId);
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Delete failed' }, { status: 500 });
  }
};
