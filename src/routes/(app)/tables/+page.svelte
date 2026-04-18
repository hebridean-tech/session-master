<script lang="ts">
  
  ;


  let { data } = $props();
  const safeTables = $derived(data?.tables ?? []);

  let inviteCode = $state('');
  let joinError = $state('');
  let joinSuccess = $state('');

  async function handleJoin(e: SubmitEvent) {
    e.preventDefault();
    joinError = '';
    joinSuccess = '';
    const res = await fetch('/api/join-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode }),
    });
    const json = await res.json();
    if (json.error) {
      joinError = json.error;
    } else {
      joinSuccess = 'Joined table!';
      inviteCode = '';
      window.location.reload();
    }
  }
</script>

<svelte:head>
  <title>My Tables — Session Master</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-bold text-stone-100">My Tables</h1>
    <a href="/tables/new" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-md transition-colors text-sm">
      + Create Table
    </a>
  </div>

  <!-- Join table -->
  <form onsubmit={handleJoin} class="bg-stone-900 border border-stone-800 rounded-lg p-5 mb-8">
    <h2 class="text-lg font-semibold text-stone-200 mb-3">Join a Table</h2>
    <div class="flex gap-3">
      <input type="text" bind:value={inviteCode} placeholder="Enter invite code" required maxlength="8"
        class="flex-1 px-4 py-2 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-600" />
      <button type="submit" class="px-5 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-md transition-colors text-sm font-medium">
        Join
      </button>
    </div>
    {#if joinError}
      <p class="text-red-400 text-sm mt-2">{joinError}</p>
    {/if}
    {#if joinSuccess}
      <p class="text-green-400 text-sm mt-2">{joinSuccess}</p>
    {/if}
  </form>

  <!-- Tables list -->
  {#if safeTables.length === 0}
    <div class="text-center py-16 text-stone-500">
      <p class="text-lg">No tables yet</p>
      <p class="text-sm mt-1">Create a table or join one with an invite code.</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each safeTables as { table, member } (table.id)}
        <a href="/tables/{table.id}" class="block bg-stone-900 border border-stone-800 rounded-lg p-5 hover:border-amber-700 transition-colors">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-stone-100">{table.name}</h3>
              {#if table.description}
                <p class="text-stone-400 text-sm mt-1">{table.description}</p>
              {/if}
              <p class="text-stone-500 text-xs mt-2">{table.systemName} · {table.edition} · {member.role.toUpperCase()}</p>
            </div>
            <span class="text-amber-600 text-sm font-mono">{table.inviteCode}</span>
            <button
              onclick={(e) => { e.preventDefault(); navigator.clipboard?.writeText(table.inviteCode); }}
              class="text-stone-500 hover:text-amber-400 text-xs ml-2"
              title="Copy invite code"
            >📋</button>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
