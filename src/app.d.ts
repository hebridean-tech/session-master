// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			session: {
				session: {
					id: string;
					userId: string;
					token: string;
					expiresAt: Date;
				};
				user: {
					id: string;
					email: string;
					name: string | null;
					emailVerified: boolean;
					image: string | null;
					createdAt: Date;
					updatedAt: Date;
				};
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
