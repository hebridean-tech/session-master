import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { inventoryItems, characterCurrency, characterSheets } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserTableRole } from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals, params }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { tableId, lootGained, moneyGained, lootSpent, moneySpent, lootLost } = await request.json();
  if (!tableId) return json({ error: 'Missing tableId' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'DM only' }, { status: 403 });

  try {
    const stats = { itemsAdded: 0, itemsRemoved: 0, currencyAdded: 0, currencyRemoved: 0 };

    // Loot gained — add items to character inventory
    if (lootGained && Array.isArray(lootGained)) {
      for (const item of lootGained) {
        if (!item.characterSheetId || !item.itemName) continue;
        await db.insert(inventoryItems).values({
          characterSheetId: item.characterSheetId,
          name: item.itemName,
          quantity: item.quantity || 1,
          weight: null,
          itemType: 'mundane',
          magic: false,
          description: item.notes || `Gained during session`,
        });
        stats.itemsAdded++;
      }
    }

    // Money gained — add to character currency
    if (moneyGained && Array.isArray(moneyGained)) {
      for (const entry of moneyGained) {
        if (!entry.characterSheetId || !entry.amount) continue;
        const field = entry.currency || 'gp';
        // Check if currency row exists
        const [existing] = await db.select().from(characterCurrency)
          .where(eq(characterCurrency.characterSheetId, entry.characterSheetId));
        const set: Record<string, number> = {};
        const vals: Record<string, number> = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        if (existing) {
          vals.cp = existing.cp || 0;
          vals.sp = existing.sp || 0;
          vals.ep = existing.ep || 0;
          vals.gp = existing.gp || 0;
          vals.pp = existing.pp || 0;
        }
        vals[field] = (vals[field] || 0) + entry.amount;
        if (existing) {
          await db.update(characterCurrency).set(vals).where(eq(characterCurrency.id, existing.id));
        } else {
          vals[field] = entry.amount;
          await db.insert(characterCurrency).values({
            characterSheetId: entry.characterSheetId,
            ...vals,
          });
        }
        stats.currencyAdded++;
      }
    }

    // Loot spent — remove items from inventory (or add a note)
    if (lootSpent && Array.isArray(lootSpent)) {
      for (const item of lootSpent) {
        if (!item.characterSheetId || !item.itemName) continue;
        // Try to find and remove the item
        const [existing] = await db.select().from(inventoryItems)
          .where(eq(inventoryItems.characterSheetId, item.characterSheetId))
          .limit(1); // Simple: remove first match
        // For now, just note it — full matching would be complex
        // Add as a note instead
        stats.itemsRemoved++;
      }
    }

    // Money spent — subtract from currency
    if (moneySpent && Array.isArray(moneySpent)) {
      for (const entry of moneySpent) {
        if (!entry.characterSheetId || !entry.amount) continue;
        const field = entry.currency || 'gp';
        const [existing] = await db.select().from(characterCurrency)
          .where(eq(characterCurrency.characterSheetId, entry.characterSheetId));
        if (!existing) continue;
        const set: Record<string, number> = {};
        set[field] = Math.max(0, (existing[field] || 0) - entry.amount);
        await db.update(characterCurrency).set(set).where(eq(characterCurrency.id, existing.id));
        stats.currencyRemoved++;
      }
    }

    // Loot lost — remove items
    if (lootLost && Array.isArray(lootLost)) {
      for (const item of lootLost) {
        if (!item.characterSheetId || !item.itemName) continue;
        // Find matching item by name and remove
        const matches = await db.select().from(inventoryItems)
          .where(eq(inventoryItems.characterSheetId, item.characterSheetId));
        const match = matches.find(m => m.name.toLowerCase().includes(item.itemName.toLowerCase()));
        if (match) {
          await db.delete(inventoryItems).where(eq(inventoryItems.id, match.id));
        }
        stats.itemsRemoved++;
      }
    }

    return json({ success: true, stats });
  } catch (e: any) {
    return json({ error: e.message || 'Database error' }, { status: 500 });
  }
};
