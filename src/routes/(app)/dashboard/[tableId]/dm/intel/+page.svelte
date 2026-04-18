<script lang="ts">
  let { data } = $props();
  const tableId = $derived(data?.table?.id || '');
  const tableName = $derived(data?.table?.name || 'Table');

  // Chat state
  let chatMessages = $state<Array<{ role: string; content: string }>>([]);
  let chatInput = $state('');
  let chatLoading = $state(false);

  // Stealth state
  let stealthDie = $state('d100');
  let stealthEncounter = $state('');
  let stealthItems = $state<any[]>([]);
  let stealthMaxRoll = $state(100);
  let stealthLoading = $state(false);
  let stealthRolled = $state(false);
  let stealthRoll = $state(0);
  let stealthNarration = $state('');
  let stealthHit = $state<any>(null);
  let stealthTarget = $state('');
  let stealthTransferring = $state(false);
  const partyMembers = $derived(data?.characters || []);

  // Active tab
  let activeTab = $state<'chat' | 'stealth'>('chat');

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    chatInput = '';
    chatMessages = [...chatMessages, { role: 'dm', content: msg }];
    chatLoading = true;
    try {
      const res = await fetch('/api/dm-intel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, message: msg }),
      });
      const data = await res.json();
      if (data.error) {
        chatMessages = [...chatMessages, { role: 'error', content: data.error }];
      } else {
        chatMessages = [...chatMessages, { role: 'ai', content: data.reply }];
      }
    } catch (e: any) {
      chatMessages = [...chatMessages, { role: 'error', content: e.message }];
    }
    chatLoading = false;
  }

  async function generateStealthMap() {
    stealthLoading = true;
    stealthRolled = false;
    stealthRoll = 0;
    stealthNarration = '';
    try {
      const res = await fetch('/api/dm-intel/stealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, dieType: stealthDie, encounter: stealthEncounter.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        stealthNarration = data.error;
      } else {
        stealthItems = data.items;
        stealthMaxRoll = data.maxRoll;
      }
    } catch (e: any) {
      stealthNarration = e.message;
    }
    stealthLoading = false;
  }

  function rollStealth() {
    stealthRoll = Math.floor(Math.random() * stealthMaxRoll) + 1;
    stealthRolled = true;
    stealthHit = null;
    stealthTarget = '';
    const hit = stealthItems.find(i => stealthRoll >= i.rangeStart && stealthRoll <= i.rangeEnd);
    if (hit) {
      stealthHit = hit;
      stealthNarration = `Rolled ${stealthRoll}: Hit range ${hit.rangeStart}-${hit.rangeEnd} — ${hit.currencyType ? '💰 ' + hit.quantity + ' ' + hit.name + '' : hit.name + ''}${hit.magic ? ' (MAGIC ITEM)' : ''} held by ${hit.characterName}!`;
    } else {
      stealthNarration = `Rolled ${stealthRoll}: Miss — nothing was targeted.`;
    }
  }

  async function confirmStealthTransfer() {
    if (!stealthHit || !stealthTarget) return;
    stealthTransferring = true;
    try {
      const sourceChar = partyMembers.find(c => c.name === stealthHit.characterName);
      if (!sourceChar) { alert('Source character not found'); stealthTransferring = false; return; }
      const res = await fetch('/api/dm-intel/stealth-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          sourceCharacterSheetId: sourceChar.id,
          targetCharacterSheetId: stealthTarget,
          itemName: stealthHit.name,
          quantity: stealthHit.quantity || 1,
          currencyType: stealthHit.currencyType || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        stealthNarration += ` → Transferred to ${partyMembers.find(c => c.id === stealthTarget)?.name || 'target'}!`;
        stealthHit = null;
        stealthTarget = '';
      } else {
        alert('Transfer failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    stealthTransferring = false;
  }

</script>

<svelte:head>
  <title>DM Intel — {tableName} — Session Master</title>
</svelte:head>

<div class="p-4 sm:p-6 max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold text-stone-100 mb-6">🔍 DM Intel</h1>

  <!-- Tab Switcher -->
  <div class="flex gap-2 mb-6">
    <button
      onclick={() => activeTab = 'chat'}
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]
        {activeTab === 'chat' ? 'bg-amber-600 text-stone-950' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}"
    >
      💬 Party Chat
    </button>
    <button
      onclick={() => activeTab = 'stealth'}
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]
        {activeTab === 'stealth' ? 'bg-amber-600 text-stone-950' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}"
    >
      🥷 Stealth Encounter
    </button>
  </div>

  <!-- Party Intelligence Chat -->
  {#if activeTab === 'chat'}
    <div class="bg-stone-900 border border-stone-800 rounded-lg">
      <!-- Messages -->
      <div class="p-4 min-h-[300px] max-h-[500px] overflow-y-auto space-y-3">
        {#if chatMessages.length === 0}
          <p class="text-stone-500 text-sm text-center py-8">
            Ask anything about the party — inventory, stats, composition, magic items...
          </p>
        {/if}
        {#each chatMessages as msg, i}
          <div class="flex {msg.role === 'dm' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[80%] rounded-lg px-4 py-2 text-sm
              {msg.role === 'dm' ? 'bg-amber-900/30 text-amber-100' :
               msg.role === 'error' ? 'bg-red-950/50 text-red-300' :
               'bg-stone-800 text-stone-200'}">
              {msg.content}
            </div>
          </div>
        {/each}
        {#if chatLoading}
          <div class="flex justify-start">
            <div class="bg-stone-800 text-stone-400 rounded-lg px-4 py-2 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        {/if}
      </div>

      <!-- Input -->
      <div class="border-t border-stone-800 p-3 flex gap-2">
        <input
          type="text"
          bind:value={chatInput}
          placeholder="What magic items does the party have?"
          class="flex-1 px-3 py-2 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          onkeydown={(e) => e.key === 'Enter' && sendChat()}
        />
        <button
          onclick={sendChat}
          disabled={chatLoading || !chatInput.trim()}
          class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-md text-sm font-medium disabled:opacity-50 min-h-[44px]"
        >
          Send
        </button>
      </div>
    </div>

  <!-- Stealth Encounter -->
  {:else}
    <div class="bg-stone-900 border border-stone-800 rounded-lg p-4 space-y-4">
      <p class="text-stone-400 text-sm">
        Assign random numbers to every item across the party, then roll to see what a pickpocket steals.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-stone-400 mb-1">Die Type</label>
          <select bind:value={stealthDie} class="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-md text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600">
            <option value="d20">d20</option>
            <option value="d100" selected>d100</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-stone-400 mb-1">Encounter Description (optional)</label>
          <input
            type="text"
            bind:value={stealthEncounter}
            placeholder="A bandit tries to steal from the party..."
            class="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>
      </div>

      <button
        onclick={generateStealthMap}
        disabled={stealthLoading}
        class="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-md text-sm font-medium disabled:opacity-50 min-h-[44px]"
      >
        {stealthLoading ? '🗺️ Mapping items...' : '🗺️ Map Items & Prepare Roll'}
      </button>

      {#if stealthItems.length > 0}
        <div class="border-t border-stone-800 pt-4">
          <h3 class="text-sm font-medium text-stone-300 mb-2">
            Item Map ({stealthItems.length} items, d{stealthMaxRoll})
          </h3>
          <div class="max-h-[200px] overflow-y-auto space-y-1 text-xs font-mono">
            {#each stealthItems as item}
              <div class="flex items-center gap-2 px-2 py-1 rounded
                {stealthRolled && stealthRoll >= item.rangeStart && stealthRoll <= item.rangeEnd
                  ? 'bg-red-950/50 text-red-300 font-bold'
                  : 'text-stone-400'}">
                <span class="w-16 text-stone-500">{item.rangeStart}-{item.rangeEnd}</span>
                <span class="flex-1">{item.name}</span>
                <span class="text-stone-600">{item.characterName}</span>
                {#if item.magic}
                  <span class="text-purple-400">✨</span>
                {/if}
                {#if item.currencyType}
                  <span class="text-amber-400">💰</span>
                {/if}
              </div>
            {/each}
          </div>

          <div class="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <button
              onclick={rollStealth}
              disabled={stealthRolled}
              class="px-5 py-3 bg-red-900/50 hover:bg-red-900/70 text-red-200 rounded-lg text-sm font-medium min-h-[44px] transition-colors"
            >
              🎲 Roll d{stealthMaxRoll}
            </button>
            {#if stealthRolled}
              <button
                onclick={() => { stealthRolled = false; stealthRoll = 0; stealthNarration = ''; }}
                class="px-3 py-2 text-stone-400 text-sm border border-stone-700 rounded hover:text-stone-200"
              >
                Re-roll
              </button>
            {/if}
            <span class="text-stone-500 text-sm">Rolled: {stealthRolled ? stealthRoll : '—'}</span>
          </div>

          {#if stealthNarration}
            <div class="mt-3 p-3 rounded-lg bg-stone-800 border border-stone-700 text-stone-200 text-sm">
              {stealthNarration}
            </div>
          {/if}

          {#if stealthHit}
            <div class="mt-3 p-3 rounded-lg bg-red-950/30 border border-red-900/50">
              <p class="text-red-300 text-sm font-medium mb-2">🔪 Steal: {stealthHit.name} from {stealthHit.characterName}?</p>
              <div class="flex flex-col sm:flex-row gap-2 items-start">
                <select
                  bind:value={stealthTarget}
                  class="px-3 py-2 bg-stone-800 border border-stone-700 rounded-md text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">Transfer to...</option>
                  {#each partyMembers as c}
                    <option value={c.id}>{c.name}</option>
                  {/each}
                </select>
                <button
                  onclick={confirmStealthTransfer}
                  disabled={!stealthTarget || stealthTransferring}
                  class="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-md text-sm font-medium disabled:opacity-50 min-h-[44px]"
                >
                  {stealthTransferring ? 'Transferring...' : '✅ Confirm Transfer'}
                </button>
                <button
                  onclick={() => { stealthHit = null; stealthTarget = ''; }}
                  class="px-3 py-2 text-stone-400 text-sm border border-stone-700 rounded hover:text-stone-200"
                >
                  Skip
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
