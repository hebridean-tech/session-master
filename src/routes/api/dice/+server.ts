import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDiceRoll, getDiceRollsByTable } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.session?.user?.id;
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { rollType, diceExpression, modifier, mode, resultJson, visibleToPlayers, requestId, tableId } = body;

  if (!rollType || !diceExpression || !resultJson || !tableId) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  const roll = await createDiceRoll({
    tableId,
    requestId: requestId || null,
    createdByUserId: userId,
    rollType,
    diceExpression,
    modifierJson: { modifier, mode },
    resultJson,
    visibleToPlayers: visibleToPlayers ?? true,
  });

  return json(roll);
};

export const GET: RequestHandler = async ({ url, locals }) => {
  const userId = locals.session?.user?.id;
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const tableId = url.searchParams.get('tableId');
  if (!tableId) return json({ error: 'Missing tableId' }, { status: 400 });

  const rolls = await getDiceRollsByTable(tableId);
  return json(rolls);
};
