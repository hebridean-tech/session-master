import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTimeWindow, deleteTimeWindow, updateTimeWindow, getTimeWindowsByTable } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params }) => {
    const windows = await getTimeWindowsByTable(params.tableId);
    return { windows };
  };

export const actions: Actions = {
    createWindow: async ({ request, params, locals }) => {
      const session = locals.session;
      if (!session?.user?.id) throw redirect(302, '/login');

      const form = await request.formData();
      const label = form.get('label') as string;
      const startAt = form.get('startAt') as string;
      const endAt = form.get('endAt') as string;
      const days = form.get('days') as string;
      const notes = form.get('notes') as string;

      if (!label?.trim()) {
        return { error: 'Label is required.' };
      }

      await createTimeWindow({
        tableId: params.tableId,
        label: label.trim(),
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        inWorldDaysAvailable: days ? parseInt(days, 10) : null,
        notes: notes?.trim() || undefined,
      });

      throw redirect(302, `/dashboard/${params.tableId}/settings`);
    },

    deleteWindow: async ({ request, params }) => {
      const form = await request.formData();
      const id = form.get('windowId') as string;
      if (id) {
        await deleteTimeWindow(id);
      }
      throw redirect(302, `/dashboard/${params.tableId}/settings`);
    },

    updateWindow: async ({ request, params }) => {
      const form = await request.formData();
      const id = form.get('windowId') as string;
      const label = form.get('label') as string;
      const startAt = form.get('startAt') as string;
      const endAt = form.get('endAt') as string;
      const days = form.get('days') as string;
      const notes = form.get('notes') as string;

      if (id) {
        await updateTimeWindow(id, {
          label: label?.trim() || undefined,
          startAt: startAt || null,
          endAt: endAt || null,
          inWorldDaysAvailable: days ? parseInt(days, 10) : null,
          notes: notes?.trim() || null,
        });
      }

      throw redirect(302, `/dashboard/${params.tableId}/settings`);
    },
  };
