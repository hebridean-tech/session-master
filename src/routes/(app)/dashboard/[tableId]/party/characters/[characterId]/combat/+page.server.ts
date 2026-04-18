import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
  const pd = await parent();
  if (!locals.session?.user?.id) throw redirect(302, '/login');
  return { tableId: params.tableId, sheet: { id: params.characterId }, role: pd.role };
};
