import { createAuthClient } from 'better-auth/client';
export const authClient = createAuthClient({
  plugins: [],
});

// Workaround: type-safe access to additional fields
export const authClientTyped = authClient.$Infer;
