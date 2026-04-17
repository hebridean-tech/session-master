import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DB = 'postgres://postgres@localhost:5432/session_master';

async function query(sql: string, params: any[] = []) {
  const res = await fetch(DB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, params }),
  });
  // Use postgres.js directly isn't available in API routes without import, let's use the db
  return res.json();
}

// We'll use the drizzle db through dynamic import
export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const tableId = url.searchParams.get('tableId');
  if (!tableId) return json({ error: 'Missing tableId' }, { status: 400 });

  const { getLootEntries } = await import('$lib/db/queries');
  const filters: any = {};
  const cat = url.searchParams.get('category');
  const rarity = url.searchParams.get('rarity');
  const itemType = url.searchParams.get('itemType');
  const homebrew = url.searchParams.get('isHomebrew');
  if (cat) filters.category = cat;
  if (rarity) filters.rarity = rarity;
  if (itemType) filters.itemType = itemType;
  if (homebrew !== null && homebrew !== undefined && homebrew !== '') filters.isHomebrew = homebrew === 'true';

  const entries = await getLootEntries(tableId, Object.keys(filters).length ? filters : undefined);
  return json(entries);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.tableId || !body.itemName) return json({ error: 'Missing required fields' }, { status: 400 });

  const { createLootEntry } = await import('$lib/db/queries');
  const entry = await createLootEntry({ ...body, createdByUserId: locals.session.user.id });
  return json(entry, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.id) return json({ error: 'Missing id' }, { status: 400 });

  const { updateLootEntry } = await import('$lib/db/queries');
  const entry = await updateLootEntry(body.id, body);
  return json(entry);
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.id) return json({ error: 'Missing id' }, { status: 400 });

  const { deleteLootEntry } = await import('$lib/db/queries');
  await deleteLootEntry(body.id);
  return json({ success: true });
};
