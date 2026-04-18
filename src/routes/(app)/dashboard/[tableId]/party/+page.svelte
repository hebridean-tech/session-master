<script lang="ts">
  let { data } = $props();
  const safe_sheets = $derived(data?.sheets);
  const partyLevel = $derived(data?.partyLevel ?? 1);
  let editingLevel = $state(false);
  let levelInput = $state(partyLevel);

  async function saveLevel() {
    try {
      const tableId = window.location.pathname.split('/')[2];
      const resp = await fetch('/api/table-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, level: levelInput }),
      });
      if (resp.ok) window.location.reload();
    } catch {}
  }
</script>

<div class="p-8">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-stone-100">Party</h1>
      <a href="/dashboard/{data?.table.id}/party/characters/new"
        class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded">
        + New Character
      </a>
    </div>

    <!-- Party Level -->
    <div class="bg-stone-900 border border-amber-900/30 rounded-lg p-5 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-amber-400">⚔️ Party Level</h2>
          <p class="text-stone-500 text-xs mt-0.5">Set by the DM. Affects loot suggestions and AI context.</p>
        </div>
        {#if editingLevel}
          <div class="flex items-center gap-2">
            <input type="number" bind:value={levelInput} min="1" max="20"
              class="w-16 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-lg font-bold text-center" />
            <button onclick={saveLevel} class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded">Save</button>
            <button onclick={() => { editingLevel = false; levelInput = partyLevel; }} class="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded">Cancel</button>
          </div>
        {:else}
          <div class="flex items-center gap-3">
            <span class="text-3xl font-bold text-stone-100">{partyLevel}</span>
            <button onclick={() => editingLevel = true} class="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded">Edit</button>
          </div>
        {/if}
      </div>
    </div>

    {#if safe_sheets.length === 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-8 text-center">
        <p class="text-stone-500">No characters yet.</p>
        <a href="/dashboard/{data?.table.id}/party/characters/new" class="text-amber-500 text-sm hover:underline mt-2 inline-block">
          Create one
        </a>
      </div>
    {:else}
      <div class="space-y-3">
        {#each safe_sheets as { sheet, user } (sheet.id)}
          {@const levelMismatch = sheet.level != null && sheet.level < partyLevel}
          <a href="/dashboard/{data?.table.id}/party/characters/{sheet.id}"
            class="block bg-stone-900 border {levelMismatch ? 'border-amber-700' : 'border-stone-800'} rounded-lg p-4 hover:border-stone-700 transition-colors">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-stone-200 font-medium">{sheet.characterName}</h3>
                <p class="text-amber-500 text-sm">{sheet.characterClass}{sheet.subclass ? ` (${sheet.subclass})` : ''} {sheet.level}</p>
                <!-- TODO: replace with multi-class string from /api/characters/classes?characterSheetId=... -->
                <p class="text-stone-500 text-xs mt-1">{user.name || user.email}</p>
              </div>
              <div class="flex flex-col items-end gap-1">
                {#if levelMismatch}
                  <span class="px-2 py-0.5 bg-emerald-900/50 text-emerald-400 text-xs rounded-full">⬆️ Level Up!</span>
                {/if}
                <span class="text-stone-600 text-sm">→</span>
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
