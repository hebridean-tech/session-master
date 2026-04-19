<script lang="ts">
  let { data } = $props();
  const safe_sheets = $derived(data?.sheets);
  const partyLevel = $derived(data?.partyLevel ?? 1);
  const isDm = $derived(data?.role === 'dm');
  const members = $derived(data?.members || []);
  let editingLevel = $state(false);
  let levelInput = $state(partyLevel);
  let transferringId = $state<string | null>(null);
  let transferMsg = $state('');

  async function transferCharacter(sheetId: string, targetUserId: string) {
    const tableId = window.location.pathname.split('/')[2];
    try {
      const resp = await fetch('/api/characters/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterSheetId: sheetId, targetUserId, tableId }),
      });
      const d = await resp.json();
      if (d.error) { transferMsg = d.error; }
      else { window.location.reload(); }
    } catch (e: any) { transferMsg = e.message; }
    transferringId = null;
  }

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

<div class="p-4 sm:p-8">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-stone-100">Party</h1>
      <a href="/dashboard/{data?.table.id}/party/characters/new"
        class="px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded min-h-[44px] flex items-center">
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

    {#if transferMsg}
      <div class="mb-4 px-4 py-2 bg-red-900/50 border border-red-800 rounded text-red-300 text-sm flex items-center justify-between">
        {transferMsg}
        <button onclick={() => transferMsg = ''} class="text-red-400 hover:text-red-200">✕</button>
      </div>
    {/if}

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
                {#if isDm && transferringId === sheet.id}
                  <div class="flex items-center gap-1">
                    <select id="transfer-{sheet.id}" class="text-xs bg-stone-800 border border-stone-600 text-stone-200 rounded px-1 py-0.5">
                      <option value="">Select user...</option>
                      {#each members as m}
                        {#if m.user.id !== sheet.userId}
                          <option value={m.user.id}>{m.user.name || m.user.email}</option>
                        {/if}
                      {/each}
                    </select>
                    <button onclick={(e) => { e.stopPropagation(); const sel = document.getElementById('transfer-{sheet.id}') as HTMLSelectElement; if (sel?.value) transferCharacter(sheet.id, sel.value); else transferringId = null; }} class="text-xs text-green-400 hover:text-green-300">✓</button>
                    <button onclick={(e) => { e.stopPropagation(); transferringId = null; }} class="text-xs text-stone-500 hover:text-stone-300">✕</button>
                  </div>
                {:else if isDm}
                  <button onclick={(e) => { e.stopPropagation(); transferringId = sheet.id; }} class="text-xs text-stone-500 hover:text-amber-400" title="Transfer character">🔄</button>
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
