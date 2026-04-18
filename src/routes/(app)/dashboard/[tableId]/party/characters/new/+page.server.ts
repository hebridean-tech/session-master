import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';

function parseCsv(val: string | null): string[] {
  if (!val?.trim()) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const { createCharacterSheet } = await import('$lib/db/queries');
    const session = locals.session;
    if (!session?.user?.id) throw redirect(302, '/login');

    const form = await request.formData();
    const characterName = form.get('characterName') as string;
    const characterClass = form.get('characterClass') as string;
    const subclass = form.get('subclass') as string;
    const level = parseInt(form.get('level') as string) || 1;
    const ancestryOrSpecies = form.get('ancestryOrSpecies') as string;
    const background = form.get('background') as string;
    const alignment = form.get('alignment') as string;
    const ac = form.get('ac') ? parseInt(form.get('ac') as string) : undefined;
    const hpMax = form.get('hpMax') ? parseInt(form.get('hpMax') as string) : undefined;
    const hpCurrent = form.get('hpCurrent') ? parseInt(form.get('hpCurrent') as string) : undefined;
    const speed = form.get('speed') ? parseInt(form.get('speed') as string) : undefined;
    const proficiencyBonus = form.get('proficiencyBonus') ? parseInt(form.get('proficiencyBonus') as string) : undefined;
    const xp = form.get('xp') ? parseInt(form.get('xp') as string) : 0;

    if (!characterName?.trim() || !characterClass?.trim() || !ancestryOrSpecies?.trim()) {
      return fail(400, { error: 'Character name, class, and ancestry/species are required.' });
    }

    const abilityScoresJson: Record<string, number> = {};
    for (const s of ['str','dex','con','int','wis','cha']) {
      const v = parseInt(form.get(`score_${s}`) as string);
      abilityScoresJson[s] = isNaN(v) ? 10 : v;
    }

    const skillProficienciesJson = parseCsv(form.get('skillProficiencies') as string);
    const languagesJson = parseCsv(form.get('languages') as string);
    const toolProficienciesJson = parseCsv(form.get('toolProficiencies') as string);

    // Hidden JSON fields for spells, inventory, currency from upload
    let pendingSpells: any[] = [];
    let pendingInventory: any[] = [];
    let pendingCurrency: any = {};
    let pendingSpellSlots: any[] = [];
    let pendingClasses: any[] = [];
    try {
      const sp = form.get('pendingSpells') as string;
      if (sp) pendingSpells = JSON.parse(sp);
    } catch {}
    try {
      const inv = form.get('pendingInventory') as string;
      if (inv) pendingInventory = JSON.parse(inv);
    } catch {}
    try {
      const cur = form.get('pendingCurrency') as string;
      if (cur) pendingCurrency = JSON.parse(cur);
    } catch {}
    try {
      const cl = form.get('pendingClasses') as string;
      if (cl) pendingClasses = JSON.parse(cl);
    } catch {}
    try {
      const ss = form.get('pendingSpellSlots') as string;
      if (ss) pendingSpellSlots = JSON.parse(ss);
    } catch {}

    const sheet = await createCharacterSheet({
      tableId: params.tableId,
      userId: session.user.id,
      characterName: characterName.trim(),
      characterClass: characterClass.trim(),
      subclass: subclass?.trim() || undefined,
      level,
      ancestryOrSpecies: ancestryOrSpecies.trim(),
      background: background?.trim() || undefined,
      alignment: alignment || undefined,
      ac,
      hpMax,
      hpCurrent: hpCurrent ?? hpMax,
      speed,
      proficiencyBonus,
      xp,
      abilityScoresJson,
      skillProficienciesJson,
      languagesJson,
      toolProficienciesJson,
      personalityTraits: (form.get('personalityTraits') as string)?.trim() || undefined,
      ideals: (form.get('ideals') as string)?.trim() || undefined,
      bonds: (form.get('bonds') as string)?.trim() || undefined,
      flaws: (form.get('flaws') as string)?.trim() || undefined,
      backstory: (form.get('backstory') as string)?.trim() || undefined,
    });

    // Create multi-class entries if provided from PDF import
    if (pendingClasses.length > 0) {
      const { createCharacterClasses } = await import('$lib/db/queries');
      await createCharacterClasses(sheet.id, pendingClasses);
    }

    // If we have pending items from upload, create them via direct DB calls
    if (pendingSpells.length > 0 || pendingInventory.length > 0 || Object.keys(pendingCurrency).length > 0) {
      // We'll handle these via API calls from the client after redirect instead
      // Store them temporarily and redirect with a flag
      // Actually, let's just insert them here
      const { db } = await import('$lib/db/index');
      const { characterSpells, inventoryItems, characterCurrency } = await import('$lib/db/schema');
      const { eq } = await import('drizzle-orm');

      for (const spell of pendingSpells.slice(0, 50)) {
        await db.insert(characterSpells).values({
          characterSheetId: sheet.id,
          name: spell.name,
          level: spell.level ?? 0,
          school: spell.school || null,
          prepared: !!spell.prepared,
          source: spell.source || 'class_feature',
        });
      }

      for (const item of pendingInventory.slice(0, 100)) {
        await db.insert(inventoryItems).values({
          characterSheetId: sheet.id,
          name: item.name,
          quantity: item.quantity || 1,
          weight: item.weight != null ? String(item.weight) : null,
          itemType: item.isMagic ? 'magic' : 'mundane',
          magic: !!item.isMagic,
          description: item.notes || null,
        });
      }

      if (Object.keys(pendingCurrency).length > 0) {
        await db.insert(characterCurrency).values({
          characterSheetId: sheet.id,
          cp: pendingCurrency.cp || 0,
          sp: pendingCurrency.sp || 0,
          ep: pendingCurrency.ep || 0,
          gp: pendingCurrency.gp || 0,
          pp: pendingCurrency.pp || 0,
        }).onConflictDoUpdate({
          target: characterCurrency.characterSheetId,
          set: {
            cp: pendingCurrency.cp || 0,
            sp: pendingCurrency.sp || 0,
            ep: pendingCurrency.ep || 0,
            gp: pendingCurrency.gp || 0,
            pp: pendingCurrency.pp || 0,
          },
        });
      }

      // Create spell slots if provided
      if (pendingSpellSlots.length > 0) {
        const { spellSlots } = await import('$lib/db/schema');
        const { eq } = await import('drizzle-orm');
        for (const slot of pendingSpellSlots) {
          if (slot.level && slot.max > 0) {
            await db.insert(spellSlots).values({
              characterSheetId: sheet.id,
              level: slot.level,
              current: slot.max,
              max: slot.max,
            });
          }
        }
      }
    }

    throw redirect(302, `/dashboard/${params.tableId}/party/characters/${sheet.id}`);
  },
};
