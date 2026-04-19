import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const tableId = url.searchParams.get('tableId');
  if (!tableId) return json({ error: 'Missing tableId' }, { status: 400 });

  const { db } = await import('$lib/db');
  const { lootEntries } = await import('$lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const items = await db.select().from(lootEntries)
    .where(and(eq(lootEntries.tableId, tableId), eq(lootEntries.category, 'shop')))
    .orderBy(lootEntries.createdAt);

  // Group by shop name
  const shopMap = new Map<string, any[]>();
  for (const item of items) {
    const name = (item as any).shopName || 'Unnamed Shop';
    if (!shopMap.has(name)) shopMap.set(name, []);
    shopMap.get(name)!.push(item);
  }

  const shops = Array.from(shopMap.entries()).map(([name, items]) => ({ name, items }));
  return json({ shops });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const { tableId, shopName } = await request.json();
  if (!tableId || !shopName) return json({ error: 'Missing fields' }, { status: 400 });

  const { db } = await import('$lib/db');
  const { lootEntries } = await import('$lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  await db.delete(lootEntries)
    .where(and(eq(lootEntries.tableId, tableId), eq(lootEntries.category, 'shop'), eq((lootEntries as any).shopName, shopName)));

  return json({ success: true });
};
