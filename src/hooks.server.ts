import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

const protectedPrefixes = ['/dashboard', '/tables', '/requests', '/party', '/notes', '/dm'];

export const handle: Handle = async ({ event, resolve }) => {
  // Get session BEFORE svelteKitHandler processes the response
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session as typeof event.locals.session;

  const response = await svelteKitHandler({ event, resolve, auth, building: false });

  const path = event.url.pathname;

  // Root redirect
  if (path === '/') {
    throw redirect(302, session ? '/dashboard' : '/login');
  }

  // Protect app routes
  if (protectedPrefixes.some(p => path.startsWith(p))) {
    if (!session) throw redirect(302, '/login');
  }

  return response;
};
