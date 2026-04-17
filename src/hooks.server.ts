import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

const protectedPrefixes = ['/dashboard', '/tables', '/requests', '/party', '/notes', '/dm'];
const authPrefix = '/api/auth';

export const handle: Handle = async ({ event, resolve }) => {
  // Get session
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session as typeof event.locals.session;

  // Only route auth API requests through Better Auth's SvelteKit handler
  // This prevents CSRF blocking on normal SvelteKit form actions
  if (event.url.pathname.startsWith(authPrefix)) {
    return svelteKitHandler({ event, resolve, auth, building: false });
  }

  const response = await resolve(event);

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
