<script lang="ts">
  import { goto } from '$app/navigation';
  import { redirect } from '@sveltejs/kit';
  
  ;

  let { data } = $props();
  const tables = $derived(data?.tables || []);

  let joinCode = $state('');
  let joinError = $state('');

  async function handleJoin(e: SubmitEvent) {
    e.preventDefault();
    joinError = '';
    const res = await fetch('/api/join-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: joinCode }),
    });
    const json = await res.json();
    if (json.error) {
      joinError = json.error;
    } else {
      return goto('/dashboard');
    }
  }
</script>

<svelte:head>
  <title>Dashboard — Session Master</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-bold text-stone-100">Select a Table</h1>
    <a href="/tables/new" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-md transition-colors text-sm">
      + New Table
    </a>
  </div>

  <!-- Join table -->
  {#if tables.length > 0}
    <form onsubmit={handleJoin} class="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-8">
      <div class="flex items-center gap-3">
        <input type="text" bind:value={joinCode} placeholder="Enter invite code" required maxlength="8"
          class="flex-1 px-3 py-2 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 uppercase tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
        <button type="submit" class="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-md transition-colors text-sm font-medium">
          Join
        </button>
        {#if joinError}
          <span class="text-red-400 text-xs">{joinError}</span>
        {/if}
      </div>
    </form>
  {/if}

  {#if tables.length === 0}
    <div class="text-center py-16 text-stone-500">
      <p class="text-lg mb-4">No tables yet</p>
      <div class="flex justify-center gap-4">
        <a href="/tables/new" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-md transition-colors">
          Create a Table
        </a>
        <form onsubmit={handleJoin} class="inline">
          <input type="text" name="code" bind:value={joinCode} placeholder="Invite code" required maxlength="8"
            class="px-3 py-2 bg-stone-800 border border-stone-700 rounded-l-md text-stone-100 placeholder-stone-500 uppercase tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
          <button type="submit" class="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-r-md transition-colors text-sm font-medium">
            Join
          </button>
        </form>
      </div>
      {#if joinError}
        <p class="text-red-400 text-sm mt-3">{joinError}</p>
      {/if}
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2">
      {#each tables as { table, member } (table.id)}
        <a href="/dashboard/{table.id}" class="block bg-stone-900 border border-stone-800 rounded-lg p-6 hover:border-amber-700 transition-colors">
          <h3 class="text-lg font-semibold text-stone-100">{table.name}</h3>
          {#if table.description}
            <p class="text-stone-400 text-sm mt-1 line-clamp-2">{table.description}</p>
          {/if}
          <p class="text-stone-500 text-xs mt-3">{table.systemName} · {member.role.toUpperCase()}</p>
        </a>
      {/each}
    </div>
  {/if}
</div>
