<script lang="ts">
  let { data } = $props();
  
  let filterAuthor = $state('');
  let filterLabel = $state('');
  let filterSource = $state('');

  $effect(() => { filterAuthor; filterLabel; filterSource; }); // reactivity hint

  let filtered = $derived(data.notes.filter(n => {
    if (filterAuthor && n.user.id !== filterAuthor) return false;
    if (filterLabel && n.note.sessionLabel !== filterLabel) return false;
    if (filterSource && n.note.sourceType !== filterSource) return false;
    return true;
  }));

  function preview(body: string) {
    return body.length > 200 ? body.slice(0, 200) + '…' : body;
  }

  const sourceBadge: Record<string, string> = {
    upload: 'bg-blue-900/50 text-blue-300',
    in_app: 'bg-green-900/50 text-green-300',
  };

  let bulkExtracting = $state(false);
  let bulkProgress = $state({ current: 0, total: 0 });
  let bulkError = $state('');

  // Loot review state
  let lootLabel = $state('');
  let lootLoading = $state(false);
  let lootData = $state<any>(null);
  let lootApplying = $state(false);
  let lootError = $state('');
  let showLootReview = $state(false);
  let editLootGained = $state<any[]>([]);
  let editMoneyGained = $state<any[]>([]);
  let editLootLost = $state<any[]>([]);
  let editMoneySpent = $state<any[]>([]);

  async function analyzeLoot() {
    if (!lootLabel.trim() || lootLoading) return;
    lootLoading = true;
    lootError = '';
    lootData = null;
    try {
      const res = await fetch('/api/dm-intel/loot-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: data?.table.id, sessionLabel: lootLabel.trim() }),
      });
      const d = await res.json();
      if (d.error) { lootError = d.error; } else {
        lootData = d;
        const charMap = d.charIdMap || {};
        editLootGained = (d.data.lootGained || []).map((i: any) => ({ ...i, characterSheetId: charMap[i.characterName] || '' }));
        editMoneyGained = (d.data.moneyGained || []).map((i: any) => ({ ...i, characterSheetId: charMap[i.characterName] || '' }));
        editLootLost = (d.data.lootLost || []).map((i: any) => ({ ...i, characterSheetId: charMap[i.characterName] || '' }));
        editMoneySpent = (d.data.moneySpent || []).map((i: any) => ({ ...i, characterSheetId: charMap[i.characterName] || '' }));
      }
    } catch (e: any) { lootError = e.message; }
    lootLoading = false;
  }

  function removeLootItem(arr: any[], index: number) { arr.splice(index, 1); }

  async function handleBulkExtract() {
    const notes = filtered.filter(n => n.note.sourceType === 'in_app' || n.note.body);
    if (notes.length === 0) return;
    bulkExtracting = true;
    bulkError = '';
    bulkProgress = { current: 0, total: notes.length };
    for (let i = 0; i < notes.length; i++) {
      bulkProgress.current = i + 1;
      try {
        await fetch('/api/ai/extract-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteId: notes[i].note.id, tableId: data?.table.id }),
        });
      } catch { /* continue on failure */ }
    }
    bulkExtracting = false;
    window.location.reload();
  }

  async function applyLoot() {
    lootApplying = true;
    try {
      const res = await fetch('/api/dm-intel/loot-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: data?.table.id,
          lootGained: editLootGained.filter(i => i.characterSheetId),
          moneyGained: editMoneyGained.filter(i => i.characterSheetId),
          lootSpent: [],
          moneySpent: editMoneySpent.filter(i => i.characterSheetId),
          lootLost: editLootLost.filter(i => i.characterSheetId),
        }),
      });
      const d = await res.json();
      if (d.success) {
        alert(`Applied: ${d.stats.itemsAdded} items added, ${d.stats.itemsRemoved} removed, ${d.stats.currencyAdded} currency updated.`);
        showLootReview = false;
        lootData = null;
      } else { alert('Failed: ' + (d.error || 'Unknown')); }
    } catch (e: any) { alert('Error: ' + e.message); }
    lootApplying = false;
  }

  const safe_notes = $derived(data?.notes);
  const safe_members = $derived(data?.members);
  const safe_labels = $derived(data?.labels);
  const safe_aiSettings = $derived(data?.aiSettings);
</script>

<div class="p-4 sm:p-8">
  <div class="max-w-2xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <h1 class="text-xl font-bold text-stone-100">Session Notes</h1>
      <div class="flex gap-2">
        {#if data?.role === 'dm' && safe_aiSettings && safe_aiSettings.permissionLevel >= 1}
          <div class="flex flex-wrap gap-2">
            {#if !bulkExtracting}
              <button onclick={handleBulkExtract}
                class="px-3 py-1.5 bg-amber-700/50 hover:bg-amber-700 text-amber-200 text-sm rounded border border-amber-800/50 flex items-center gap-1.5">
                🏷️ Extract Entities
              </button>
              <button onclick={() => showLootReview = !showLootReview}
                class="px-3 py-1.5 bg-amber-700/50 hover:bg-amber-700 text-amber-200 text-sm rounded border border-amber-800/50 flex items-center gap-1.5">
                💰 Analyze Loot
              </button>
            {:else}
              <button disabled
                class="px-3 py-1.5 bg-amber-700/50 text-amber-200 text-sm rounded border border-amber-800/50 flex items-center gap-1.5 opacity-75">
                <span class="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full"></span>
                Processing {bulkProgress.current} of {bulkProgress.total}…
              </button>
            {/if}
          </div>
        {/if}
        <a href="/dashboard/{data?.table.id}/notes/new"
          class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded">
          + Add Note
        </a>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6">
      <select bind:value={filterAuthor} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-3 min-h-[44px]">
        <option value="">All authors</option>
        {#each safe_members as { user } (user.id)}
          <option value={user.id}>{user.name || user.email}</option>
        {/each}
      </select>
      <select bind:value={filterLabel} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-3 min-h-[44px]">
        <option value="">All sessions</option>
        {#each safe_labels as label}
          <option value={label}>{label}</option>
        {/each}
      </select>
      <select bind:value={filterSource} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-3 min-h-[44px]">
        <option value="">All types</option>
        <option value="upload">Uploaded</option>
        <option value="in_app">Written in-app</option>
      </select>
    </div>

    {#if filtered.length === 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-8 text-center">
        <p class="text-stone-500">{safe_notes.length === 0 ? 'No notes yet.' : 'No notes match filters.'}</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each filtered as { note, user } (note.id)}
          <a href="/dashboard/{data?.table.id}/notes/{note.id}"
            class="block bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-stone-700 transition-colors">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs px-1.5 py-0.5 rounded {sourceBadge[note.sourceType] || 'bg-stone-700 text-stone-400'}">
                    {note.sourceType === 'upload' ? 'Uploaded' : 'Written in-app'}
                  </span>
                  {#if note.sessionLabel}
                    <span class="text-xs text-stone-500">Session: {note.sessionLabel}</span>
                  {/if}
                  {#if note.visibility === 'dm_only'}
                    <span class="text-xs px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">DM Only</span>
                  {/if}
                </div>
                <h3 class="text-stone-200 font-medium truncate">{note.title}</h3>
                <p class="text-stone-500 text-sm mt-1 line-clamp-2">{preview(note.body)}</p>
                <p class="text-stone-600 text-xs mt-2">{user.name || user.email} · {new Date(note.createdAt).toLocaleDateString()}</p>
              </div>
              <span class="text-stone-600 text-sm">→</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}

    <!-- Loot Review Panel (DM only) -->
    {#if showLootReview && data?.role === 'dm'}
      <div class="mt-6 bg-stone-900 border border-stone-800 rounded-lg p-4 space-y-4">
        <h2 class="text-lg font-semibold text-stone-200">💰 Loot Review</h2>
        <p class="text-stone-400 text-sm">Cross-reference all notes for a session and extract loot gained/spent/lost.</p>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            bind:value={lootLabel}
            placeholder="Session label (e.g. Session 12)"
            class="flex-1 px-3 py-2 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            onkeydown={(e) => e.key === 'Enter' && analyzeLoot()}
          />
          <button
            onclick={analyzeLoot}
            disabled={lootLoading || !lootLabel.trim()}
            class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-md text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            {lootLoading ? '🔍 Analyzing...' : '🔍 Analyze'}
          </button>
          <button onclick={() => showLootReview = false} class="px-3 py-2 text-stone-400 text-sm border border-stone-700 rounded hover:text-stone-200">
            ✕
          </button>
        </div>
        {#if lootError}
          <div class="bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-red-300 text-sm">{lootError}</div>
        {/if}
        {#if lootData}
          <div class="border-t border-stone-800 pt-3">
            <h3 class="text-sm font-semibold text-stone-200 mb-1">📋 Summary</h3>
            <p class="text-stone-300 text-sm">{lootData.data.summary}</p>
            <p class="text-stone-500 text-xs mt-1">{lootData.noteCount} notes from: {lootData.notesAuthors.join(', ')}</p>
          </div>
          {#if editLootGained.length > 0}
            <div class="border-t border-stone-800 pt-3">
              <h3 class="text-sm font-semibold text-emerald-400 mb-2">📦 Loot Gained</h3>
              {#each editLootGained as item, i}
                <div class="flex items-start gap-2 bg-stone-800 rounded p-2 text-sm mb-1">
                  <div class="flex-1">
                    <span class="text-stone-200">{item.itemName}</span> <span class="text-stone-500 text-xs">×{item.quantity || 1}</span>
                    <span class="text-stone-400 text-xs ml-2">→ {item.characterName}</span>
                    {#if item.notes}<span class="text-stone-500 text-xs block">{item.notes}</span>{/if}
                  </div>
                  <button onclick={() => removeLootItem(editLootGained, i)} class="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
              {/each}
            </div>
          {/if}
          {#if editMoneyGained.length > 0}
            <div class="border-t border-stone-800 pt-3">
              <h3 class="text-sm font-semibold text-yellow-400 mb-2">💰 Money Gained</h3>
              {#each editMoneyGained as entry, i}
                <div class="flex items-start gap-2 bg-stone-800 rounded p-2 text-sm mb-1">
                  <div class="flex-1">
                    <span class="text-stone-200">{entry.amount} {entry.currency}</span>
                    <span class="text-stone-400 text-xs ml-2">→ {entry.characterName}</span>
                    {#if entry.notes}<span class="text-stone-500 text-xs block">{entry.notes}</span>{/if}
                  </div>
                  <button onclick={() => removeLootItem(editMoneyGained, i)} class="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
              {/each}
            </div>
          {/if}
          {#if editLootLost.length > 0}
            <div class="border-t border-stone-800 pt-3">
              <h3 class="text-sm font-semibold text-red-400 mb-2">💔 Loot Lost</h3>
              {#each editLootLost as item, i}
                <div class="flex items-start gap-2 bg-stone-800 rounded p-2 text-sm mb-1">
                  <div class="flex-1">
                    <span class="text-stone-200">{item.itemName}</span> <span class="text-stone-500 text-xs">×{item.quantity || 1}</span>
                    <span class="text-stone-400 text-xs ml-2">← {item.characterName}</span>
                    <span class="text-stone-500 text-xs block">{item.reason}</span>
                  </div>
                  <button onclick={() => removeLootItem(editLootLost, i)} class="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
              {/each}
            </div>
          {/if}
          {#if editMoneySpent.length > 0}
            <div class="border-t border-stone-800 pt-3">
              <h3 class="text-sm font-semibold text-orange-400 mb-2">💸 Money Spent</h3>
              {#each editMoneySpent as entry, i}
                <div class="flex items-start gap-2 bg-stone-800 rounded p-2 text-sm mb-1">
                  <div class="flex-1">
                    <span class="text-stone-200">{entry.amount} {entry.currency}</span>
                    <span class="text-stone-400 text-xs ml-2">← {entry.characterName}</span>
                    {#if entry.notes}<span class="text-stone-500 text-xs block">{entry.notes}</span>{/if}
                  </div>
                  <button onclick={() => removeLootItem(editMoneySpent, i)} class="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
              {/each}
            </div>
          {/if}
          {#if editLootGained.length === 0 && editMoneyGained.length === 0 && editLootLost.length === 0 && editMoneySpent.length === 0}
            <p class="text-stone-500 text-sm text-center py-3">No loot changes detected.</p>
          {/if}
          {#if (editLootGained.length + editMoneyGained.length + editLootLost.length + editMoneySpent.length) > 0}
            <div class="border-t border-stone-800 pt-3">
              <button
                onclick={applyLoot}
                disabled={lootApplying}
                class="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md text-sm font-medium disabled:opacity-50 min-h-[44px]"
              >
                {lootApplying ? 'Applying...' : '✅ Apply to Inventories'}
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</div>
