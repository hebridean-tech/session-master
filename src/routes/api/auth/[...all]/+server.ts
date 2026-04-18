import { auth } from '$lib/auth';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import type { RequestHandler } from './$types';

const handler = toSvelteKitHandler(auth);

export const GET: RequestHandler = handler;
export const POST: RequestHandler = handler;
