import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { updateCharacterSheet, getCharacterSheetById, getTableMembers } from '$lib/db/queries';
import { db } from '$lib/db';
import { characterSpells, spellSlots, inventoryItems, characterCurrency } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    const pd = await parent();
    const session = locals.session;
    if (!session?.user?.id) throw redirect(302, '/login');
    const sheet = await getCharacterSheetById(params.characterId);
    if (!sheet) throw redirect(302, `/dashboard/${params.tableId}/party`);
    const canEdit = session.user.id === sheet.sheet.userId || pd.role === 'dm';
    const partyLevel = pd.table?.currentLevel ?? 1;

    const [spells, slots, items, currencyRows] = await Promise.all([
      db.select().from(characterSpells).where(eq(characterSpells.characterSheetId, params.characterId)),
      db.select().from(spellSlots).where(eq(spellSlots.characterSheetId, params.characterId)),
      db.select().from(inventoryItems).where(eq(inventoryItems.characterSheetId, params.characterId)),
      db.select().from(characterCurrency).where(eq(characterCurrency.characterSheetId, params.characterId)),
    ]);

    const members = await getTableMembers(params.tableId);

    return {
      sheet: sheet.sheet, canEdit, userName: sheet.user.name, partyLevel, isDm: pd.role === 'dm',
      members,
      spells, spellSlots: slots, inventory: items,
      currency: currencyRows[0] || { characterSheetId: params.characterId, cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    };
  };

export const actions: Actions = {
    update: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');

      const form = await request.formData();
      const updateData: Record<string, unknown> = {};

      for (const key of ['characterName','characterClass','subclass','ancestryOrSpecies','background','alignment','dmNotes','notes']) {
        const val = form.get(key) as string;
        if (val !== undefined) updateData[key] = val === '' ? null : val;
      }

      for (const key of ['level','ac','hpCurrent','hpMax','speed','xp','xpToNextLevel','proficiencyBonus'] as const) {
        const v = parseInt(form.get(key) as string);
        if (!isNaN(v)) updateData[key] = v;
      }

      const scores: Record<string, number> = {};
      for (const s of ['str','dex','con','int','wis','cha']) {
        const v = parseInt(form.get(`score_${s}`) as string);
        scores[s] = isNaN(v) ? 10 : v;
      }
      updateData.abilityScoresJson = scores;

      // JSON proficiencies
      for (const field of ['skillProfsJson','toolProfsJson','languagesJson'] as const) {
        const raw = form.get(field) as string;
        if (raw) {
          try { updateData[field] = JSON.parse(raw); } catch {}
        }
      }

      const conditionsStr = (form.get('conditions') as string) || '';
      updateData.conditionActiveJson = conditionsStr ? conditionsStr.split(',').map(c => c.trim()).filter(Boolean) : [];

      await updateCharacterSheet(params.characterId, updateData);
      throw redirect(302, `/dashboard/${params.tableId}/party/characters/${params.characterId}`);
    },

    updateDmNotes: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');
      const form = await request.formData();
      await updateCharacterSheet(params.characterId, { dmNotes: form.get('dmNotes') as string || null });
      throw redirect(302, `/dashboard/${params.tableId}/party/characters/${params.characterId}`);
    },
  };
