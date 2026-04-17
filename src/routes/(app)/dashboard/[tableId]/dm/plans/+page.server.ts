import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDmPlansByTable } from '$lib/db/queries';

export const load: PageServerLoad = async ({ params, parent }) => {
  const { role } = await parent();
  if (role !== 'dm') throw redirect(302, `/dashboard/${params.tableId}`);

  const plans = await getDmPlansByTable(params.tableId);
  return { plans };
};
