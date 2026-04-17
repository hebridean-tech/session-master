import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  updateSuggestion, getSuggestionsByRequest, findInventoryItemByName,
  addInventoryItem, removeInventoryItem, updateInventoryItemQuantity,
  updateCharacterCurrency, createActivityLog,
} from '$lib/db/queries';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const { suggestionId, action, tableId } = await request.json();
  if (!suggestionId || !action || !tableId) return json({ error: 'Missing fields' }, { status: 400 });

  // Fetch the suggestion — we need all suggestions from same source to find this one
  // Use a simpler approach: query by sourceId from the request, then filter
  const { db } = await import('$lib/db');
  const { inventoryChangeSuggestions } = await import('$lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const [suggestion] = await db.select().from(inventoryChangeSuggestions).where(eq(inventoryChangeSuggestions.id, suggestionId)).limit(1);
  if (!suggestion) return json({ error: 'Suggestion not found' }, { status: 404 });

  if (action === 'reject') {
    await updateSuggestion(suggestionId, {
      reviewStatus: 'rejected',
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
    });
    return json({ success: true, status: 'rejected' });
  }

  if (action === 'approve') {
    try {
      // Apply the suggestion
      const { characterSheetId, changeType, itemName, quantityDelta, currencyDeltaJson } = suggestion;

      if (changeType === 'add_item' && itemName) {
        await addInventoryItem({
          characterSheetId,
          name: itemName,
          quantity: quantityDelta ?? 1,
          sourceType: 'ai_suggestion',
          sourceId: suggestionId,
        });
      } else if (changeType === 'remove_item' && itemName) {
        const existing = await findInventoryItemByName(characterSheetId, itemName);
        if (existing) {
          await removeInventoryItem(existing.id, quantityDelta ?? undefined);
        }
      } else if (changeType === 'quantity_change' && itemName) {
        const existing = await findInventoryItemByName(characterSheetId, itemName);
        if (existing && quantityDelta) {
          await updateInventoryItemQuantity(existing.id, quantityDelta);
        }
      } else if (changeType === 'currency_change' && currencyDeltaJson) {
        await updateCharacterCurrency(characterSheetId, currencyDeltaJson as Record<string, number>);
      }

      await updateSuggestion(suggestionId, {
        reviewStatus: 'approved',
        reviewedByUserId: session.user.id,
        reviewedAt: new Date(),
      });

      await createActivityLog({
        tableId,
        actorUserId: session.user.id,
        eventType: 'inventory_suggestion_applied',
        objectType: 'inventory_suggestion',
        objectId: suggestionId,
        summary: `AI suggestion approved: ${itemName || 'currency change'} (${changeType})`,
      });

      return json({ success: true, status: 'approved' });
    } catch (e: any) {
      return json({ error: e.message || 'Failed to apply suggestion' }, { status: 500 });
    }
  }

  return json({ error: 'Invalid action' }, { status: 400 });
};
