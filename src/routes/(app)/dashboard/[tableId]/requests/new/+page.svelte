<script lang="ts">
  let { data } = $props();
  
  let category = $state('training');
  let customCategory = $state('');
  let showMaterials = $state(false);
  let showRules = $state(false);
  let materials: { name: string; qty: string }[] = $state([{ name: '', qty: '1' }]);

  const categories = [
    { value: 'training', label: 'Training', icon: '📚' },
    { value: 'crafting', label: 'Crafting', icon: '🔨' },
    { value: 'shopping', label: 'Shopping/Trade', icon: '💰' },
    { value: 'research', label: 'Research', icon: '📖' },
    { value: 'business', label: 'Business/Faction', icon: '🏛️' },
    { value: 'travel', label: 'Travel', icon: '🗺️' },
    { value: 'social', label: 'Social Action', icon: '🎭' },
    { value: 'custom', label: 'Custom', icon: '✨' },
  ];

  const safe_characters = $derived((data as any)?.characters);
  const safe_activeWindow = $derived((data as any)?.activeWindow);
  const safe_remainingDays = $derived((data as any)?.remainingDays);
</script>

<div class="p-8">
  <div class="max-w-xl mx-auto">
    <h1 class="text-2xl font-bold text-stone-100 mb-6">New Downtime Request</h1>

    <form method="POST" class="space-y-5">
      <!-- Character -->
      {#if safe_characters.length > 0}
        <div>
          <label class="block text-sm font-medium text-stone-400 mb-1">Character</label>
          <select name="characterSheetId"
            class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600">
            {#each safe_characters as ch}
              <option value={ch.id}>{ch.characterName} (Lvl {ch.level} {ch.characterClass})</option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Category -->
      <div>
        <label class="block text-sm font-medium text-stone-400 mb-2">Category</label>
        <div class="grid grid-cols-4 gap-2">
          {#each categories as cat}
            <button type="button" onclick={() => category = cat.value}
              class="flex flex-col items-center gap-1 p-2 rounded border text-xs
              {category === cat.value ? 'border-amber-600 bg-amber-900/20 text-amber-400' : 'border-stone-700 text-stone-400 hover:border-stone-600'}">
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          {/each}
        </div>
        <input type="hidden" name="category" value={category} />
        {#if category === 'custom'}
          <input name="customCategory" bind:value={customCategory} placeholder="Custom category name"
            class="mt-2 w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
        {/if}
      </div>

      <!-- Title -->
      <div>
        <label class="block text-sm font-medium text-stone-400 mb-1">Title *</label>
        <input name="title" type="text" required placeholder="What do you want to do?"
          class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-stone-400 mb-1">Description *</label>
        <textarea name="description" required rows="4" placeholder="Describe your downtime activity..."
          class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600"></textarea>
      </div>

      <!-- Time & Gold -->
      {#if safe_remainingDays > 0}
        <div class="bg-stone-800 border border-amber-900/30 rounded px-3 py-2 text-sm">
          <span class="text-amber-400">⏱ {safe_activeWindow?.label}</span>
          <span class="text-stone-400"> — {safe_remainingDays} days remaining</span>
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-stone-400 mb-1">Time (days)</label>
          <input name="requestedTimeDays" type="number" min="0" placeholder="0"
            class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
        </div>
        <div>
          <label class="block text-sm font-medium text-stone-400 mb-1">Gold Cost (gp)</label>
          <input name="goldCostRequested" type="number" min="0" placeholder="0"
            class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
        </div>
      </div>

      <!-- Materials -->
      <div>
        <button type="button" onclick={() => showMaterials = !showMaterials}
          class="text-sm text-stone-400 hover:text-stone-200 flex items-center gap-1">
          <span class="text-xs">{showMaterials ? '▼' : '▶'}</span> Materials / Items
        </button>
        {#if showMaterials}
          <div class="mt-2 space-y-2">
            {#each materials as m, i}
              <div class="flex gap-2 items-center">
                <input name="materialName" placeholder="Item name" bind:value={materials[i].name}
                  class="flex-1 bg-stone-900 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
                <input name="materialQty" type="number" min="1" bind:value={materials[i].qty}
                  class="w-20 bg-stone-900 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm text-center" />
                <button type="button" onclick={() => materials.splice(i, 1)} class="text-stone-600 hover:text-red-400 text-sm px-1">✕</button>
              </div>
            {/each}
            <button type="button" onclick={() => materials.push({ name: '', qty: '1' })}
              class="text-xs text-amber-500 hover:text-amber-400">+ Add another</button>
          </div>
        {/if}
      </div>

      <!-- Rules Reference -->
      <div>
        <button type="button" onclick={() => showRules = !showRules}
          class="text-sm text-stone-400 hover:text-stone-200 flex items-center gap-1">
          <span class="text-xs">{showRules ? '▼' : '▶'}</span> Rules Reference
        </button>
        {#if showRules}
          <textarea name="rulesReference" rows="2" placeholder="Any relevant rules, page numbers..."
            class="mt-2 w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600"></textarea>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex gap-3 pt-4">
        <button type="submit" name="action" value="submit"
          class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded">
          Submit
        </button>
        <button type="submit" name="action" value="draft"
          class="px-4 py-2 text-stone-400 hover:text-stone-200 text-sm rounded border border-stone-700">
          Save Draft
        </button>
        <a href="/dashboard/{data?.table.id}/requests"
          class="px-4 py-2 text-stone-500 hover:text-stone-300 text-sm">Cancel</a>
      </div>
    </form>
  </div>
</div>
