import type { PageServerLoad } from './$types';
import { getUserTableRole, getTableById } from '$lib/db/queries';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) throw redirect(302, '/');

  const tableId = params.tableId;
  const role = await getUserTableRole(session.user.id, tableId);

  if (!role || role.role !== 'dm') {
    throw redirect(302, `/dashboard/${tableId}`);
  }

  const table = await getTableById(tableId);
  return { table, role: role.role };
};
