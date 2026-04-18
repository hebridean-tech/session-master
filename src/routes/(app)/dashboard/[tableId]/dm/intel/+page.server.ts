import type { PageServerLoad } from './$types';
import { getUserTableRole, getTableById } from '$lib/db/queries';
import { db } from '$lib/db';
import { characterSheets, user } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
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

  const characters = await db.select({
    id: characterSheets.id,
    name: characterSheets.characterName,
    ownerName: user.name,
  })
    .from(characterSheets)
    .innerJoin(user, eq(characterSheets.userId, user.id))
    .where(eq(characterSheets.tableId, tableId));

  return { table, role: role.role, characters };
};
