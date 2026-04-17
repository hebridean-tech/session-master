<script lang="ts">
	import { authClient } from '$lib/auth/client';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const { error: err } = await authClient.signIn.email({ email, password });
		if (err) {
			error = err.message || 'Login failed';
		} else {
			goto('/dashboard');
		}
	}
</script>

<svelte:head>
	<title>Log In — Session Master</title>
</svelte:head>

<div class="min-h-screen bg-stone-950 flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-amber-500">Session Master</h1>
			<p class="text-stone-400 mt-2">Log in to your campaign</p>
		</div>

		<form onsubmit={handleLogin} class="bg-stone-900 rounded-lg p-8 shadow-lg border border-stone-800">
			{#if error}
				<div class="bg-red-900/50 border border-red-800 text-red-200 rounded px-4 py-3 mb-6 text-sm">
					{error}
				</div>
			{/if}

			<div class="space-y-5">
				<div>
					<label for="email" class="block text-sm font-medium text-stone-300 mb-1.5">Email</label>
					<input id="email" type="email" bind:value={email} required
						class="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent" />
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-stone-300 mb-1.5">Password</label>
					<input id="password" type="password" bind:value={password} required
						class="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent" />
				</div>

				<button type="submit"
					class="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-md transition-colors">
					Log In
				</button>
			</div>
		</form>

		<p class="text-center text-stone-500 mt-6 text-sm">
			Don't have an account? <a href="/signup" class="text-amber-500 hover:text-amber-400">Sign up</a>
		</p>
	</div>
</div>
