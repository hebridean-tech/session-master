import { auth } from '$lib/auth';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import type { RequestHandler } from './$types';

const handler = toSvelteKitHandler(auth);

export const GET: RequestHandler = (event) => handler(event) as Response;
export const POST: RequestHandler = (event) => handler(event) as Response;
export const PUT: RequestHandler = (event) => handler(event) as Response;
export const DELETE: RequestHandler = (event) => handler(event) as Response;
export const PATCH: RequestHandler = (event) => handler(event) as Response;
