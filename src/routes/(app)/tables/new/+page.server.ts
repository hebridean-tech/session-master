import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const { createTable } = await import('$lib/db/queries');
    const session = locals.session;
    if (!session?.user?.id) {
      return redirect(302, '/login');
    }

    const form = await request.formData();
    const name = form.get('name') as string;
    const description = form.get('description') as string;
    const systemName = form.get('system_name') as string;
    const edition = form.get('edition') as string;
    const timezone = form.get('timezone') as string;

    if (!name) {
      return { error: 'Table name is required' };
    }

    const table = await createTable({
      name,
      description: description || undefined,
      systemName: systemName || 'D&D 5e',
      edition: edition || '2024',
      timezone: timezone || undefined,
      ownerUserId: session.user.id,
    });

    redirect(302, `/tables/${table.id}`);
  },
};
