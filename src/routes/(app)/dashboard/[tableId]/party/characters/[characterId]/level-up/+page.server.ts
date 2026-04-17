import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCharacterSheetById } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
  const session = locals.session;
  if (!session?.user?.id) throw redirect(302, '/login');
  const pd = await parent();
  const sheet = await getCharacterSheetById(params.characterId);
  if (!sheet) throw redirect(302, `/dashboard/${params.tableId}/party`);
  const canEdit = session.user.id === sheet.sheet.userId || pd.role === 'dm';
  return { sheet: sheet.sheet, canEdit };
};
