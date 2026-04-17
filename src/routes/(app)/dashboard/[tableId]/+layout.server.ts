import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
    const { getTableById, getUserTableRole } = await import('$lib/db/queries');
    const session = locals.session;
    if (!session?.user?.id) throw redirect(302, '/login');

    const table = await getTableById(params.tableId);
    if (!table) throw redirect(302, '/dashboard');

    const role = await getUserTableRole(session.user.id, params.tableId);
    if (!role) throw redirect(302, '/dashboard');

    return {
      table,
      role: role.role as string,
      userId: session.user.id,
    };
  }
