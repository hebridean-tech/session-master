import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { inventoryItems, characterCurrency } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserTableRole } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { tableId, sourceCharacterSheetId, targetCharacterSheetId, itemName, quantity, currencyType } = await request.json();
  if (!tableId || !sourceCharacterSheetId || !targetCharacterSheetId || !itemName) {
    return json({ error: 'Missing fields' }, { status: 400 });
  }

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    if (currencyType) {
      // Currency transfer
      const sourceCur = await db.select().from(characterCurrency).where(eq(characterCurrency.characterSheetId, sourceCharacterSheetId));
      if (!sourceCur.length) return json({ error: 'No currency record for source.' }, { status: 404 });
      const col = currencyType as 'cp' | 'sp' | 'ep' | 'gp' | 'pp';
      const current = sourceCur[0][col] || 0;
      const stealAmount = Math.min(quantity || 1, current);
      if (stealAmount <= 0) return json({ error: `No ${currencyType} to steal.` }, { status: 400 });

      // Deduct from source
      await db.update(characterCurrency).set({ [col]: current - stealAmount, updatedAt: new Date() }).where(eq(characterCurrency.characterSheetId, sourceCharacterSheetId));

      // Add to target
      const targetCur = await db.select().from(characterCurrency).where(eq(characterCurrency.characterSheetId, targetCharacterSheetId));
      if (targetCur.length) {
        await db.update(characterCurrency).set({ [col]: (targetCur[0][col] || 0) + stealAmount, updatedAt: new Date() }).where(eq(characterCurrency.characterSheetId, targetCharacterSheetId));
      } else {
        const vals: Record<string, any> = { characterSheetId: targetCharacterSheetId, updatedAt: new Date(), cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        vals[col] = stealAmount;
        await db.insert(characterCurrency).values(vals);
      }

      return json({ success: true, item: `${stealAmount} ${currencyType}`, quantity: stealAmount });
    }

    // Item transfer (original logic)
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
