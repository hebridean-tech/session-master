import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createDowntimeRequest } from '$lib/db/queries';

export const actions: Actions = {
    default: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');

      const form = await request.formData();
      const title = form.get('title') as string;
      const description = form.get('description') as string;
      if (!title?.trim() || !description?.trim()) {
        return fail(400, { error: 'Title and description are required.' });
      }

      let category = form.get('category') as string;
      let customCategory = form.get('customCategory') as string;
      if (category === 'custom' && customCategory?.trim()) {
        category = `Custom: ${customCategory.trim()}`;
      }

      // Parse materials
      const materialNames = form.getAll('materialName') as string[];
      const materialQtys = form.getAll('materialQty') as string[];
      const materials = [];
      for (let i = 0; i < materialNames.length; i++) {
        if (materialNames[i]?.trim()) {
          materials.push({ name: materialNames[i].trim(), quantity: parseInt(materialQtys[i]) || 1 });
        }
      }

      const rawAction = form.get('action') as string; // 'draft' or 'submit'
      const status = rawAction === 'submit' ? 'submitted' : (rawAction || 'draft');
      await createDowntimeRequest({
        tableId: params.tableId,
        createdByUserId: session.user.id,
        characterSheetId: form.get('characterSheetId') as string || undefined,
        category,
        title: title.trim(),
        description: description.trim(),
        status,
        rulesReference: (form.get('rulesReference') as string) || undefined,
        requestedTimeDays: parseInt(form.get('requestedTimeDays') as string) || undefined,
        goldCostRequested: parseInt(form.get('goldCostRequested') as string) || undefined,
        materialsJson: materials.length > 0 ? materials : undefined,
      });

      throw redirect(302, `/dashboard/${params.tableId}/requests`);
    },
  };
