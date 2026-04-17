import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    const { getAiSettings } = await import('$lib/db/queries');
    const session = locals.session;
    if (!session?.user?.id) throw redirect(302, '/login');

    const pd = await parent();
    if (pd.role !== 'dm') throw redirect(302, `/dashboard/${params.tableId}`);

    const settings = await getAiSettings(params.tableId);
    // Never send apiKey to client
    return {
      settings: settings ? { ...settings, apiKeyRef: settings.apiKeyRef ? '••••' : null } : null,
    };
  }
