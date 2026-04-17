import { auth } from '$lib/auth';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

const protectedPrefixes = ['/dashboard', '/tables', '/requests', '/party', '/notes', '/dm'];

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session as typeof event.locals.session;

  const path = event.url.pathname;

  if (path === '/') {
    throw redirect(302, session ? '/dashboard' : '/login');
  }

  if (protectedPrefixes.some(p => path.startsWith(p))) {
    if (!session) throw redirect(302, '/login');
  }

  return resolve(event);
};
