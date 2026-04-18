<script lang="ts">
  import { onMount } from 'svelte';

  let { data } = $props();

  const RARITIES = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'mundane'];
  const ITEM_TYPES = ['weapon', 'armor', 'potion', 'wondrous', 'ring', 'scroll', 'wand', 'rod', 'staff', 'tool', 'gear', 'other'];
  const RARITY_COLORS: Record<string, string> = {
    common: 'text-stone-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    very_rare: 'text-purple-400',
    legendary: 'text-amber-400',
    mundane: 'text-stone-500',
  };

  let activeTab: 'loot' | 'shops' = $state('loot');
  let lootItems = $state<any[]>(data.lootEntries || []);
  let characters = $state<any[]>(data.characters || []);
  let tableId = data.table.id;

  // Filters
  let filterRarity = $state('');
  let filterType = $state('');
  let filterHomebrew = $state('');

  // Form
  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let form = $state({ itemName: '', itemType: 'wondrous', rarity: 'common', quantity: 1, valueGp: 0, description: '', isHomebrew: false, awardedToCharacterId: '', sourceRef: '', notes: '' });

  // Encounter loot generation
  let encounterItems = $state<any[]>([]);
  let encounterGenerating = $state(false);
  let enemyType = $state('');
  let encounterHomebrew = $state(false);
  let encounterPower = $state<string>('balanced');
  let encounterInstructions = $state('');

  // Shop generation
  let shopItems = $state<any[]>([]);
  let shopGenerating = $state(false);
  let shopPrompt = $state('');
  let shopHomebrew = $state(false);

  // Chat
  let chatMessages = $state<{ role: string; content: string }[]>([]);
  let chatInput = $state('');
  let chatLoading = $state(false);

  const filteredLoot = $derived(
    lootItems.filter(i => i.category === 'loot' &&
      (!filterRarity || i.rarity === filterRarity) &&
      (!filterType || i.item_type === filterType) &&
      (filterHomebrew === '' || (filterHomebrew === 'yes' ? i.is_homebrew : !i.is_homebrew))
    )
  );

  const filteredShop = $derived(
    lootItems.filter(i => i.category === 'shop')
  );

  async function refresh() {
    const params = new URLSearchParams({ tableId });
    if (filterRarity) params.set('rarity', filterRarity);
    if (filterType) params.set('itemType', filterType);
    if (filterHomebrew) params.set('isHomebrew', filterHomebrew);
    const res = await fetch(`/api/loot?${params}`);
    lootItems = await res.json();
  }

  async function saveEntry() {
    const body = { tableId, ...form, awardedToCharacterId: form.awardedToCharacterId || null };
    if (editingId) {
      await fetch('/api/loot', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...body }) });
    } else {
      await fetch('/api/loot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    resetForm();
    await refresh();
  }

  async function deleteEntry(id: string) {
    await fetch('/api/loot', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await refresh();
  }

  function editEntry(item: any) {
    editingId = item.id;
    form = {
      itemName: item.item_name,
      itemType: item.item_type,
      rarity: item.rarity,
      quantity: item.quantity,
      valueGp: Number(item.value_gp),
      description: item.description || '',
      isHomebrew: item.is_homebrew,
      awardedToCharacterId: item.awarded_to_character_id || '',
      sourceRef: item.source_ref || '',
      notes: item.notes || '',
    };
    showForm = true;
  }

  function resetForm() {
    showForm = false;
    editingId = null;
    form = { itemName: '', itemType: 'wondrous', rarity: 'common', quantity: 1, valueGp: 0, description: '', isHomebrew: false, awardedToCharacterId: '', sourceRef: '', notes: '' };
  }

  async function generateEncounterLoot() {
    if (!enemyType.trim()) return;
    encounterGenerating = true;
    try {
      const res = await fetch('/api/loot/generate-encounter-loot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, enemyType: enemyType.trim(), allowHomebrew: encounterHomebrew, powerLevel: encounterPower, additionalInstructions: encounterInstructions.trim() || undefined }),
      });
      const data = await res.json();
      if (data.items) encounterItems = data.items;
    } catch (e) { console.error(e); }
    encounterGenerating = false;
  }

  async function approveEncounterItem(item: any) {
    const entry: any = {
      tableId, category: 'loot',
      itemName: item.itemName, itemType: item.itemType, rarity: item.rarity,
      quantity: item.quantity || 1, valueGp: item.valueGp || 0,
      description: item.description, isHomebrew: item.isHomebrew || false,
    };
    if (item.itemType === 'currency' && item.quantity && item.valueGp) {
      entry.notes = `Total: ${item.quantity} × ${item.valueGp} gp = ${(item.quantity * item.valueGp).toFixed(2)} gp`;
    }
    await fetch('/api/loot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    encounterItems = encounterItems.filter(i => i !== item);
    await refresh();
  }

  async function approveAllEncounterItems() {
    for (const item of [...encounterItems]) await approveEncounterItem(item);
    encounterItems = [];
  }

  async function generateShop() {
    shopGenerating = true;
    try {
      const res = await fetch('/api/loot/generate-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, allowHomebrew: shopHomebrew, prompt: shopPrompt || undefined }),
      });
      const data = await res.json();
      if (data.items) shopItems = data.items;
    } catch (e) {
      console.error(e);
    }
    shopGenerating = false;
  }

  async function approveShopItem(item: any) {
    await fetch('/api/loot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId,
        category: 'shop',
        itemName: item.itemName,
        itemType: item.itemType,
        rarity: item.rarity,
        quantity: item.quantity || 1,
        valueGp: item.valueGp || 0,
        description: item.description,
        isHomebrew: item.isHomebrew || false,
      }),
    });
    shopItems = shopItems.filter(i => i !== item);
    await refresh();
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    chatMessages = [...chatMessages, { role: 'user', content: msg }];
    chatInput = '';
    chatLoading = true;
    try {
      const res = await fetch('/api/loot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, message: msg, history: chatMessages.slice(0, -1) }),
      });
      const data = await res.json();
      chatMessages = [...chatMessages, { role: 'assistant', content: data.response || data.error || 'No response' }];
    } catch (e: any) {
      chatMessages = [...chatMessages, { role: 'assistant', content: 'Error: ' + e.message }];
    }
    chatLoading = false;
  }
</script>

{#if data.role !== 'dm'}
  <div class="p-8 text-center text-stone-400">DM only area.</div>
{:else}
<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-stone-700">
    <h1 class="text-xl font-bold text-amber-500">🗝️ Loot & Shops</h1>
    <div class="flex gap-2">
      <button onclick={() => activeTab = 'loot'} class="px-4 py-1.5 rounded text-sm font-medium transition-colors {activeTab === 'loot' ? 'bg-amber-600 text-white' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}">
        Loot
      </button>
      <button onclick={() => activeTab = 'shops'} class="px-4 py-1.5 rounded text-sm font-medium transition-colors {activeTab === 'shops' ? 'bg-amber-600 text-white' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}">
        Shops
      </button>
    </div>
  </div>

  <!-- Content area -->
  <div class="flex-1 overflow-y-auto p-6">
    {#if activeTab === 'loot'}
      <!-- Loot Tab -->
      <div class="flex flex-wrap gap-3 mb-4 items-center">
        <button onclick={() => { resetForm(); showForm = true; }} class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium">
          + Add Loot
        </button>
        <select bind:value={filterRarity} onchange={refresh} class="bg-stone-800 text-stone-200 border border-stone-600 rounded px-3 py-2 text-sm">
          <option value="">All Rarities</option>
          {#each RARITIES as r}<option value={r}>{r.replace('_', ' ')}</option>{/each}
        </select>
        <select bind:value={filterType} onchange={refresh} class="bg-stone-800 text-stone-200 border border-stone-600 rounded px-3 py-2 text-sm">
          <option value="">All Types</option>
          {#each ITEM_TYPES as t}<option value={t}>{t}</option>{/each}
        </select>
        <select bind:value={filterHomebrew} onchange={refresh} class="bg-stone-800 text-stone-200 border border-stone-600 rounded px-3 py-2 text-sm">
          <option value="">Homebrew: Any</option>
          <option value="yes">Homebrew Only</option>
          <option value="no">Official Only</option>
        </select>
      </div>

      <!-- Encounter Loot Generator -->
      <div class="bg-stone-800/50 border border-stone-700 rounded-lg p-4 mb-4">
        <h3 class="text-amber-400 font-semibold mb-3 text-sm">⚔️ Generate Encounter Loot</h3>
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-48">
            <label class="text-xs text-stone-400">Enemy / Creature Type</label>
            <input bind:value={enemyType} placeholder="e.g. Goblin raiding party, Adult Red Dragon" class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm" />
          </div>
          <div>
            <label class="text-xs text-stone-400">Power Level</label>
            <select bind:value={encounterPower} class="bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm">
              <option value="middling">Middling</option>
              <option value="balanced">Balanced</option>
              <option value="exciting">Exciting</option>
              <option value="overpowered">Overpowered</option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-sm text-stone-300 pb-1">
            <input type="checkbox" bind:checked={encounterHomebrew} class="accent-amber-600" />
            Homebrew
          </label>
          <button onclick={generateEncounterLoot} disabled={encounterGenerating || !enemyType.trim()} class="px-4 py-2 bg-red-800 hover:bg-red-700 disabled:bg-stone-600 disabled:text-stone-500 text-white rounded text-sm font-medium">
            {encounterGenerating ? '⏳ Generating...' : '💀 Generate Loot'}
          </button>
        </div>
        <div class="mt-2">
          <input bind:value={encounterInstructions} placeholder="Additional instructions (optional, e.g. "no potions", "focus on weapons")" class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm" />
        </div>

        <!-- Generated encounter loot for review -->
        {#if encounterItems.length > 0}
          <div class="mt-3 flex items-center justify-between">
            <h4 class="text-amber-400 text-sm font-semibold">Review Generated Loot ({encounterItems.length} items)</h4>
            <button onclick={approveAllEncounterItems} class="text-xs text-green-400 hover:text-green-300">✓ Approve All</button>
          </div>
          <div class="space-y-2 mt-2">
            {#each encounterItems as item, i}
              <div class="bg-stone-900 border border-amber-900/50 rounded-lg p-3 flex items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-stone-200 text-sm">{item.itemName}</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-stone-700 text-stone-300">{item.itemType}</span>
                    <span class="text-xs {RARITY_COLORS[item.rarity] || 'text-stone-400'}">{item.rarity?.replace('_', ' ')}</span>
                    {#if item.isHomebrew}
                      <span class="text-xs px-2 py-0.5 rounded bg-purple-900 text-purple-300">Homebrew</span>
                    {/if}
                    {#if item.quantity > 1}
                      <span class="text-xs text-stone-500">×{item.quantity}</span>
                    {/if}
                    {#if Number(item.valueGp) > 0}
                      <span class="text-xs text-amber-500">{item.valueGp} gp</span>
                    {/if}
                  </div>
                  {#if item.description}
                    <p class="text-xs text-stone-400 mt-1">{item.description}</p>
                  {/if}
                </div>
                <div class="flex gap-1">
                  <button onclick={() => approveEncounterItem(item)} class="px-2 py-1 text-xs bg-green-800 hover:bg-green-700 text-green-200 rounded">✓</button>
                  <button onclick={() => encounterItems = encounterItems.filter((_, j) => j !== i)} class="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-300 rounded">✗</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Add/Edit Form -->
      {#if showForm}
        <div class="bg-stone-800 border border-stone-600 rounded-lg p-4 mb-6">
          <h3 class="text-amber-400 font-semibold mb-3">{editingId ? 'Edit' : 'Add'} Loot Entry</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-stone-400">Name</label>
              <input bind:value={form.itemName} class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm" />
            </div>
            <div>
              <label class="text-xs text-stone-400">Type</label>
              <select bind:value={form.itemType} class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm">
                {#each ITEM_TYPES as t}<option value={t}>{t}</option>{/each}
              </select>
            </div>
            <div>
              <label class="text-xs text-stone-400">Rarity</label>
              <select bind:value={form.rarity} class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm">
                {#each RARITIES as r}<option value={r}>{r.replace('_', ' ')}</option>{/each}
              </select>
            </div>
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="text-xs text-stone-400">Qty</label>
                <input type="number" bind:value={form.quantity} min="1" class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm" />
              </div>
              <div class="flex-1">
                <label class="text-xs text-stone-400">Value (gp)</label>
                <input type="number" bind:value={form.valueGp} min="0" step="0.01" class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm" />
              </div>
            </div>
            <div>
              <label class="text-xs text-stone-400">Awarded To</label>
              <select bind:value={form.awardedToCharacterId} class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm">
                <option value="">— None —</option>
                {#each characters as row}<option value={row.sheet.id}>{row.sheet.characterName}</option>{/each}
              </select>
            </div>
            <div>
              <label class="text-xs text-stone-400">Source (encounter/event)</label>
              <input bind:value={form.sourceRef} class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm" />
            </div>
            <div class="col-span-2">
              <label class="text-xs text-stone-400">Description</label>
              <textarea bind:value={form.description} rows="2" class="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm"></textarea>
            </div>
            <div class="col-span-2 flex items-center gap-4">
              <label class="flex items-center gap-2 text-sm text-stone-300">
                <input type="checkbox" bind:checked={form.isHomebrew} class="accent-amber-600" />
                Homebrew
              </label>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button onclick={saveEntry} class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm">Save</button>
            <button onclick={resetForm} class="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded text-sm">Cancel</button>
          </div>
        </div>
      {/if}

      <!-- Loot List -->
      {#if filteredLoot.length === 0}
        <p class="text-stone-500 text-sm">No loot entries found.</p>
      {:else}
        <div class="space-y-2">
          {#each filteredLoot as item}
            <div class="bg-stone-800 border border-stone-700 rounded-lg p-4 flex items-start gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-stone-200">{item.item_name}</span>
                  <span class="text-xs px-2 py-0.5 rounded bg-stone-700 text-stone-300">{item.item_type}</span>
                  <span class="text-xs {RARITY_COLORS[item.rarity] || 'text-stone-400'}">{item.rarity.replace('_', ' ')}</span>
                  {#if item.is_homebrew}
                    <span class="text-xs px-2 py-0.5 rounded bg-purple-900 text-purple-300">Homebrew</span>
                  {/if}
                  <span class="text-xs text-stone-500">×{item.quantity}</span>
                  {#if Number(item.value_gp) > 0}
                    <span class="text-xs text-amber-500">{item.value_gp} gp</span>
                  {/if}
                  {#if item.source_ref}
                    <span class="text-xs text-stone-500">from: {item.source_ref}</span>
                  {/if}
                </div>
                {#if item.description}
                  <p class="text-sm text-stone-400 mt-1">{item.description}</p>
                {/if}
                {#if item.awarded_to_character_id}
                  {@const awardedChar = characters.find(row => row.sheet.id === item.awarded_to_character_id)}
                  {#if awardedChar}
                    <span class="text-xs text-amber-600">→ {awardedChar.sheet.characterName}</span>
                  {/if}
                {/if}
              </div>
              <div class="flex gap-1">
                <button onclick={() => editEntry(item)} class="px-2 py-1 text-xs bg-stone-700 hover:bg-stone-600 text-stone-300 rounded">Edit</button>
                <button onclick={() => deleteEntry(item.id)} class="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-300 rounded">Delete</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

    {:else}
      <!-- Shops Tab -->
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-3 flex-wrap">
          <input bind:value={shopPrompt} placeholder="Shop type / location hint (e.g. 'magic shop in a mountain town')" class="flex-1 min-w-60 bg-stone-800 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm" />
          <label class="flex items-center gap-2 text-sm text-stone-300">
            <input type="checkbox" bind:checked={shopHomebrew} class="accent-amber-600" />
            Allow Homebrew
          </label>
          <button onclick={generateShop} disabled={shopGenerating} class="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-600 disabled:text-stone-500 text-white rounded text-sm font-medium">
            {shopGenerating ? '⏳ Generating...' : '✨ Generate Shop'}
          </button>
        </div>

        <!-- Generated items for review -->
        {#if shopItems.length > 0}
          <h3 class="text-amber-400 font-semibold mb-2">Review Generated Items</h3>
          <div class="space-y-2 mb-4">
            {#each shopItems as item, i}
              <div class="bg-stone-800 border border-amber-900/50 rounded-lg p-4 flex items-start gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-stone-200">{item.itemName}</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-stone-700 text-stone-300">{item.itemType}</span>
                    <span class="text-xs {RARITY_COLORS[item.rarity] || 'text-stone-400'}">{item.rarity?.replace('_', ' ')}</span>
                    {#if item.isHomebrew}
                      <span class="text-xs px-2 py-0.5 rounded bg-purple-900 text-purple-300">Homebrew</span>
                    {/if}
                    <span class="text-xs text-amber-500">{item.valueGp} gp</span>
                  </div>
                  {#if item.description}
                    <p class="text-sm text-stone-400 mt-1">{item.description}</p>
                  {/if}
                </div>
                <div class="flex gap-1">
                  <button onclick={() => approveShopItem(item)} class="px-3 py-1 text-xs bg-green-800 hover:bg-green-700 text-green-200 rounded">✓ Approve</button>
                  <button onclick={() => shopItems = shopItems.filter((_, j) => j !== i)} class="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-300 rounded">✗ Reject</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Existing shop items -->
      <h3 class="text-stone-300 font-semibold mb-2">Saved Shop Items</h3>
      {#if filteredShop.length === 0}
        <p class="text-stone-500 text-sm">No shop items saved yet.</p>
      {:else}
        <div class="space-y-2">
          {#each filteredShop as item}
            <div class="bg-stone-800 border border-stone-700 rounded-lg p-4 flex items-start gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-stone-200">{item.item_name}</span>
                  <span class="text-xs px-2 py-0.5 rounded bg-stone-700 text-stone-300">{item.item_type}</span>
                  <span class="text-xs {RARITY_COLORS[item.rarity] || 'text-stone-400'}">{item.rarity.replace('_', ' ')}</span>
                  <span class="text-xs text-amber-500">{item.value_gp} gp</span>
                </div>
                {#if item.description}
                  <p class="text-sm text-stone-400 mt-1">{item.description}</p>
                {/if}
              </div>
              <button onclick={() => deleteEntry(item.id)} class="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-300 rounded">Delete</button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- AI Chat -->
  <div class="border-t border-stone-700 bg-stone-900">
    <div class="px-4 py-2 border-b border-stone-800 flex items-center justify-between">
      <span class="text-xs text-stone-400 font-medium">Loot Assistant</span>
      {#if chatMessages.length > 0}
        <button onclick={() => chatMessages = []} class="text-xs text-stone-500 hover:text-stone-300">Clear</button>
      {/if}
    </div>
    <div class="h-40 overflow-y-auto px-4 py-2 space-y-2">
      {#each chatMessages as msg}
        <div class="text-sm {msg.role === 'user' ? 'text-amber-400 text-right' : 'text-stone-300'}">
          <div class="inline-block max-w-[80%] px-3 py-1.5 rounded {msg.role === 'user' ? 'bg-stone-700' : 'bg-stone-800'}">
            {@html msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}
          </div>
        </div>
      {/each}
      {#if chatLoading}
        <div class="text-sm text-stone-500 italic">Thinking...</div>
      {/if}
    </div>
    <div class="px-4 py-2 flex gap-2">
      <input
        bind:value={chatInput}
        placeholder="Ask about loot, items, shops..."
        onkeydown={(e) => e.key === 'Enter' && sendChat()}
        disabled={chatLoading}
        class="flex-1 bg-stone-800 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm disabled:opacity-50"
      />
      <button onclick={sendChat} disabled={chatLoading || !chatInput.trim()} class="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-700 disabled:text-stone-500 text-white rounded text-sm">
        Send
      </button>
    </div>
  </div>
</div>
{/if}
