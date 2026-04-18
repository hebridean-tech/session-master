<script lang="ts">
  let { data } = $props();
  const sheetId = $derived(data?.sheet?.id);
  const tableId = $derived(data?.tableId);

  let character = $state<any>(null);
  let features = $state<any[]>([]);
  let attacks = $state<any[]>([]);
  let spells = $state<any[]>([]);
  let spellSlots = $state<any[]>([]);
  let resources = $state<any[]>([]);
  let passivePerception = $state(10);
  let loading = $state(true);

  // Attack form
  let showAddAttack = $state(false);
  let newAttack = $state({ name: '', attackBonus: 0, damage: '', damageType: '', abilityUsed: 'STR', rangeType: 'melee', rangeFt: '' });

  // Feature edit
  let editingFeature = $state<string | null>(null);

  async function loadCombat() {
    loading = true;
    try {
      const resp = await fetch(`/api/characters/${sheetId}/combat`);
      if (resp.ok) {
        const d = await resp.json();
        character = d.character;
        features = d.features || [];
        attacks = d.attacks || [];
        spells = d.spells || [];
        spellSlots = d.spellSlots || [];
        resources = d.resources || [];
        passivePerception = d.passivePerception || 10;
      }
    } catch (e) { console.error(e); }
    loading = false;
  }

  // Group features by action type
  const actionGroups = $derived(() => {
    const groups: Record<string, any[]> = { action: [], bonus_action: [], reaction: [], attack_action: [], free: [], special: [], passive: [] };
    for (const f of features) {
      const key = f.actionType || 'passive';
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    return groups;
  });

  const spellsByLevel = $derived(() => {
    const map: Record<number, any[]> = {};
    for (const sp of spells) {
      const lvl = sp.level ?? 0;
      if (!map[lvl]) map[lvl] = [];
      map[lvl].push(sp);
    }
    return map;
  });

  async function resetRest(type: 'short_rest' | 'long_rest') {
    const resp = await fetch(`/api/characters/${sheetId}/combat/resources/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
    });
    if (resp.ok) {
      resources = (await resp.json()).resources;
      if (type === 'long_rest' && character) character.hpCurrent = character.hpMax;
    }
  }

  async function adjustResource(id: string, delta: number) {
    const r = resources.find(x => x.id === id);
    if (!r) return;
    const newVal = Math.max(0, Math.min(r.max, r.current + delta));
    const resp = await fetch(`/api/characters/${sheetId}/combat/resources/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: newVal }),
    });
    if (resp.ok) resources = resources.map(x => x.id === id ? { ...x, current: newVal } : x);
  }

  async function addAttack() {
    if (!newAttack.name.trim()) return;
    const resp = await fetch(`/api/characters/${sheetId}/attacks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newAttack, attackBonus: parseInt(String(newAttack.attackBonus)) || 0, rangeFt: newAttack.rangeFt ? parseInt(newAttack.rangeFt) : null }),
    });
    if (resp.ok) { attacks = [...attacks, await resp.json()]; showAddAttack = false; newAttack = { name: '', attackBonus: 0, damage: '', damageType: '', abilityUsed: 'STR', rangeType: 'melee', rangeFt: '' }; }
  }

  async function deleteAttack(id: string) {
    await fetch(`/api/characters/${sheetId}/attacks/${id}`, { method: 'DELETE' });
    attacks = attacks.filter(a => a.id !== id);
  }

  async function updateFeature(id: string, updates: any) {
    const resp = await fetch(`/api/characters/${sheetId}/features/${id}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }
    );
    if (resp.ok) {
      const updated = await resp.json();
      features = features.map(f => f.id === id ? updated : f);
    }
    editingFeature = null;
  }

  async function syncAttacks() {
    const resp = await fetch(`/api/characters/${sheetId}/attacks/sync`, { method: 'POST' });
    if (resp.ok) attacks = (await resp.json()).attacks;
  }

  const ACTION_LABELS: Record<string, string> = {
    action: 'Action', bonus_action: 'Bonus Action', reaction: 'Reaction',
    attack_action: 'Attack', free: 'Free', passive: 'Passive', special: 'Special',
  };

  $effect(() => { loadCombat(); });
</script>

{#if loading}
  <div class="flex items-center justify-center py-20">
    <div class="text-stone-400 text-lg">Loading combat data...</div>
  </div>
{:else if character}
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 class="text-2xl font-bold text-stone-100">{character.name}</h1>
        <p class="text-stone-400">Level {character.level} {character.class}{character.subclass ? ` (${character.subclass})` : ''}</p>
      </div>
      <div class="flex gap-2">
        <button onclick={() => resetRest('short_rest')} class="px-3 py-1.5 bg-amber-700/30 hover:bg-amber-700/50 text-amber-300 rounded text-sm font-medium border border-amber-700/40">
          ⏸ Short Rest
        </button>
        <button onclick={() => resetRest('long_rest')} class="px-3 py-1.5 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 rounded text-sm font-medium border border-emerald-700/40">
          🌙 Long Rest
        </button>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="flex flex-wrap gap-4 text-sm">
      <span class="text-stone-200">HP: <span class="text-red-400 font-bold">{character.hpCurrent}/{character.hpMax}</span></span>
      <span class="text-stone-200">AC: <span class="text-amber-400 font-bold">{character.ac ?? '—'}</span></span>
      <span class="text-stone-200">Speed: <span class="text-stone-300">{character.speed ?? '—'} ft</span></span>
      <span class="text-stone-200">Prof: <span class="text-amber-400">+{character.proficiencyBonus}</span></span>
      <span class="text-stone-200">Passive Perception: <span class="text-stone-300">{passivePerception}</span></span>
    </div>

    <!-- Action Economy -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {#each ['action', 'bonus_action', 'reaction', 'free'] as col}
        <div class="bg-stone-800/50 rounded-lg border border-stone-700/50 p-3">
          <h2 class="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">{ACTION_LABELS[col]}</h2>
          <div class="space-y-1.5">
            {#each actionGroups()[col] || [] as feature (feature.id)}
              <div class="group relative">
                <button onclick={() => editingFeature = feature.id} class="text-left w-full text-sm text-stone-200 hover:text-amber-400 transition-colors" title="Click to edit">
                  {feature.name}
                  {#if feature.damage}
                    <span class="text-red-400 ml-1">({feature.damage})</span>
                  {/if}
                </button>
                {#if editingFeature === feature.id}
                  <div class="absolute top-full left-0 z-20 bg-stone-800 border border-stone-600 rounded p-2 shadow-lg mt-1 w-48">
                    <select value={feature.actionType} onchange={(e) => updateFeature(feature.id, { actionType: (e.target as HTMLSelectElement).value })} class="w-full bg-stone-900 text-stone-200 text-xs rounded p-1 border border-stone-600 mb-1">
                      {#each Object.entries(ACTION_LABELS) as [val, label]}
                        <option value={val}>{label}</option>
                      {/each}
                    </select>
                    <button onclick={() => editingFeature = null} class="text-xs text-stone-400 hover:text-stone-200">Close</button>
                  </div>
                {/if}
              </div>
            {/each}
            {#if (actionGroups()[col] || []).length === 0}
              <span class="text-stone-500 text-xs italic">None</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Attack Actions -->
    {#if (actionGroups()['attack_action'] || []).length > 0}
      <div class="bg-stone-800/50 rounded-lg border border-stone-700/50 p-3">
        <h2 class="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Attack Actions</h2>
        <div class="space-y-1">
          {#each actionGroups()['attack_action'] || [] as feature (feature.id)}
            <div class="text-sm text-stone-200">{feature.name} {#if feature.damage}({feature.damage}){/if}</div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Passive Abilities -->
    {#if (actionGroups()['passive'] || []).length > 0}
      <div class="bg-stone-800/50 rounded-lg border border-stone-700/50 p-3">
        <h2 class="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Passive Abilities</h2>
        <div class="space-y-1">
          {#each actionGroups()['passive'] || [] as feature (feature.id)}
            <div class="text-sm text-stone-300">
              <span class="text-stone-200">{feature.name}</span>
              {#if feature.description}
                <p class="text-xs text-stone-400 mt-0.5 line-clamp-2">{feature.description}</p>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Resources -->
    <div class="bg-stone-800/50 rounded-lg border border-stone-700/50 p-3">
      <h2 class="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Resources</h2>
      {#if resources.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {#each resources as r (r.id)}
            <div class="flex items-center justify-between bg-stone-900/50 rounded px-3 py-2">
              <span class="text-sm text-stone-200">{r.name}</span>
              <div class="flex items-center gap-2">
                <button onclick={() => adjustResource(r.id, -1)} class="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs font-bold">−</button>
                <span class="text-sm font-mono text-stone-100">{r.current}<span class="text-stone-500">/{r.max}</span></span>
                <button onclick={() => adjustResource(r.id, 1)} class="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs font-bold">+</button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <span class="text-stone-500 text-xs italic">No resources tracked</span>
      {/if}
    </div>

    <!-- Attacks -->
    <div class="bg-stone-800/50 rounded-lg border border-stone-700/50 p-3">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xs font-bold text-amber-500 uppercase tracking-wider">Attacks</h2>
        <div class="flex gap-2">
          <button onclick={syncAttacks} class="text-xs text-stone-400 hover:text-amber-400">Sync from Inventory</button>
          <button onclick={() => showAddAttack = !showAddAttack} class="text-xs text-amber-500 hover:text-amber-400">+ Add Attack</button>
        </div>
      </div>

      {#if showAddAttack}
        <div class="bg-stone-900/50 rounded p-3 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input bind:value={newAttack.name} placeholder="Name" class="bg-stone-900 text-stone-200 text-sm rounded px-2 py-1 border border-stone-600 col-span-2 sm:col-span-1" />
          <input type="number" bind:value={newAttack.attackBonus} placeholder="+hit" class="bg-stone-900 text-stone-200 text-sm rounded px-2 py-1 border border-stone-600" />
          <input bind:value={newAttack.damage} placeholder="1d8+4" class="bg-stone-900 text-stone-200 text-sm rounded px-2 py-1 border border-stone-600" />
          <input bind:value={newAttack.damageType} placeholder="slashing" class="bg-stone-900 text-stone-200 text-sm rounded px-2 py-1 border border-stone-600" />
          <select bind:value={newAttack.abilityUsed} class="bg-stone-900 text-stone-200 text-sm rounded px-2 py-1 border border-stone-600">
            <option value="STR">STR</option><option value="DEX">DEX</option><option value="CON">CON</option>
            <option value="INT">INT</option><option value="WIS">WIS</option><option value="CHA">CHA</option>
          </select>
          <select bind:value={newAttack.rangeType} class="bg-stone-900 text-stone-200 text-sm rounded px-2 py-1 border border-stone-600">
            <option value="melee">Melee</option><option value="ranged">Ranged</option><option value="both">Both</option>
            <option value="thrown">Thrown</option><option value="reach">Reach</option>
          </select>
          <input bind:value={newAttack.rangeFt} placeholder="Range ft" class="bg-stone-900 text-stone-200 text-sm rounded px-2 py-1 border border-stone-600" />
          <div class="flex gap-1 col-span-2 sm:col-span-1">
            <button onclick={addAttack} class="flex-1 bg-amber-700 hover:bg-amber-600 text-stone-100 rounded px-2 py-1 text-sm">Add</button>
            <button onclick={() => showAddAttack = false} class="bg-stone-700 hover:bg-stone-600 text-stone-300 rounded px-2 py-1 text-sm">Cancel</button>
          </div>
        </div>
      {/if}

      <div class="space-y-1">
        {#each attacks as atk (atk.id)}
          <div class="flex items-center justify-between bg-stone-900/30 rounded px-3 py-1.5 group">
            <div class="text-sm text-stone-200">
              <span class="font-medium">{atk.name}</span>
              {#if atk.attackBonus != null}
                <span class="text-amber-400 ml-1">+{atk.attackBonus}</span>
              {/if}
              {#if atk.damage}
                <span class="text-red-400 ml-1">{atk.damage}</span>
              {/if}
              {#if atk.damageType}
                <span class="text-stone-500 ml-1">{atk.damageType}</span>
              {/if}
              <span class="text-stone-500 ml-1">{atk.rangeType}</span>
              {#if atk.rangeFt}
                <span class="text-stone-500">{atk.rangeFt}ft</span>
              {/if}
              {#if atk.isVersatile && atk.versatileDamage}
                <span class="text-stone-500 ml-1">(2h: {atk.versatileDamage})</span>
              {/if}
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick={() => deleteAttack(atk.id)} class="text-red-400 hover:text-red-300 text-xs p-1" title="Delete">🗑️</button>
            </div>
          </div>
        {:else}
          <span class="text-stone-500 text-xs italic">No attacks added yet</span>
        {/each}
      </div>
    </div>

    <!-- Spellcasting -->
    {#if spells.length > 0}
      <div class="bg-stone-800/50 rounded-lg border border-stone-700/50 p-3">
        <h2 class="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Spellcasting</h2>
        <div class="space-y-2">
          {#each Object.entries(spellsByLevel()) as [levelStr, levelSpells]}
            {@const level = parseInt(levelStr)}
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-stone-200">{level === 0 ? 'Cantrips' : `${level}${level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'} Level`}</span>
                {#if level > 0}
                  {@const slot = spellSlots.find(s => s.level === level)}
                  {#if slot}
                    <span class="text-xs text-stone-400">({slot.current}/{slot.max} slots)</span>
                  {/if}
                {/if}
              </div>
              <div class="flex flex-wrap gap-1">
                {#each levelSpells as sp}
                  <span class="inline-flex items-center gap-1 bg-stone-900/50 text-stone-300 text-xs rounded px-2 py-0.5">
                    {sp.name}
                    {#if sp.castingTime}
                      <span class="text-stone-500 text-[10px]">{sp.castingTime}</span>
                    {/if}
                  </span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Back link -->
    <div class="pt-2">
      <a href="/dashboard/{tableId}/party/characters/{sheetId}" class="text-sm text-stone-400 hover:text-amber-400">← Back to Character</a>
    </div>
  </div>
{/if}
