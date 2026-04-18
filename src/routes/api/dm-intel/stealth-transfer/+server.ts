import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { inventoryItems } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserTableRole } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { tableId, sourceCharacterSheetId, targetCharacterSheetId, itemName, quantity } = await request.json();
  if (!tableId || !sourceCharacterSheetId || !targetCharacterSheetId || !itemName) {
    return json({ error: 'Missing fields' }, { status: 400 });
  }

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    // Find the item in source inventory
    const items = await db.select().from(inventoryItems)
      .where(eq(inventoryItems.characterSheetId, sourceCharacterSheetId));

    const match = items.find(i => i.name.toLowerCase().includes(itemName.toLowerCase()));
    if (!match) {
      return json({ error: `Item "${itemName}" not found in source inventory.` }, { status: 404 });
    }

    // If quantity specified and item has more than that, reduce quantity
    const qty = quantity || match.quantity || 1;
    if (match.quantity && match.quantity > qty) {
      await db.update(inventoryItems)
        .set({ quantity: match.quantity - qty })
        .where(eq(inventoryItems.id, match.id));
    } else {
      // Remove the item entirely
      await db.delete(inventoryItems).where(eq(inventoryItems.id, match.id));
    }

    // Check if target already has this item
    const targetItems = await db.select().from(inventoryItems)
      .where(eq(inventoryItems.characterSheetId, targetCharacterSheetId));
    const existingTarget = targetItems.find(i => i.name.toLowerCase() === match.name.toLowerCase());

    if (existingTarget) {
      await db.update(inventoryItems)
        .set({ quantity: (existingTarget.quantity || 1) + qty })
        .where(eq(inventoryItems.id, existingTarget.id));
    } else {
      await db.insert(inventoryItems).values({
        characterSheetId: targetCharacterSheetId,
        name: match.name,
        quantity: qty,
        weight: match.weight,
        itemType: match.itemType,
        magic: match.magic,
        description: match.description,
      });
    }

    return json({ success: true, item: match.name, quantity: qty });
  } catch (e: any) {
    return json({ error: e.message || 'Database error' }, { status: 500 });
  }
};
