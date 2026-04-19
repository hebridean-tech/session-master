import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { lootEntryId, characterSheetId, deductCost, tableId } = body;
  if (!lootEntryId || !characterSheetId) return json({ error: 'Missing fields' }, { status: 400 });

  const { db } = await import('$lib/db');
  const { lootEntries, inventoryItems } = await import('$lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { addInventoryItem, updateCharacterCurrency } = await import('$lib/db/queries');

  // Fetch the loot entry
  const [entry] = await db.select().from(lootEntries).where(eq(lootEntries.id, lootEntryId)).limit(1);
  if (!entry) return json({ error: 'Loot entry not found' }, { status: 404 });

  const itemValueGp = parseFloat(String(entry.valueGp)) || 0;

  // If deducting cost (shop purchase), check currency first
  if (deductCost && itemValueGp > 0) {
    const { characterCurrency } = await import('$lib/db/schema');
    const [cur] = await db.select().from(characterCurrency)
      .where(eq(characterCurrency.characterSheetId, characterSheetId)).limit(1);

    if (cur) {
      // Convert gp to cp for comparison: 1gp = 100cp, 1sp = 10cp, 1ep = 50cp, 1pp = 1000cp
      const balanceCp = (cur.cp || 0) + (cur.sp || 0) * 10 + (cur.ep || 0) * 50 + (cur.gp || 0) * 100 + (cur.pp || 0) * 1000;
      const costCp = Math.ceil(itemValueGp * 100);
      if (balanceCp < costCp) {
        return json({ error: `Not enough funds. Need ${itemValueGp} gp.` }, { status: 400 });
      }
    }
  }

  // Add to inventory
  await addInventoryItem({
    characterSheetId,
    name: entry.itemName,
    quantity: entry.quantity || 1,
    itemType: entry.itemType || 'gear',
    description: entry.description || undefined,
    magic: entry.rarity === 'rare' || entry.rarity === 'very_rare' || entry.rarity === 'legendary' ? true : false,
    rarity: entry.rarity || undefined,
    sourceType: entry.category === 'shop' ? 'shop_purchase' : 'loot',
    sourceId: entry.id,
  });

  // Deduct currency if shop purchase
  if (deductCost && itemValueGp > 0) {
    // Convert gp to negative delta in gp column (round to avoid float issues)
    await updateCharacterCurrency(characterSheetId, { gp: -Math.ceil(itemValueGp) });
  }

  // Remove from loot entries (or reduce quantity)
  if (entry.quantity > 1) {
    const newQty = entry.quantity - 1;
    await db.update(lootEntries)
      .set({ quantity: newQty, updatedAt: new Date() })
      .where(eq(lootEntries.id, lootEntryId));
  } else {
    await db.delete(lootEntries).where(eq(lootEntries.id, lootEntryId));
  }

  return json({ success: true });
};
