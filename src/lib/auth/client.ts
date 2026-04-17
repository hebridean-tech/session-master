import { createAuthClient } from 'better-auth/client';
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  plugins: [],
});

// Workaround: type-safe access to additional fields
export const authClientTyped = authClient.$Infer;
