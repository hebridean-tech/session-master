<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { parseAndRoll, formatResult, type RollResult } from '$lib/dice';

  const diceOptions = [
    { label: 'd4', expr: '1d4' },
    { label: 'd6', expr: '1d6' },
    { label: 'd8', expr: '1d8' },
    { label: 'd10', expr: '1d10' },
    { label: 'd12', expr: '1d12' },
    { label: 'd20', expr: '1d20' },
    { label: 'd100', expr: '1d100' },
    { label: 'Custom', expr: '' },
  ];

  let tableId = $derived(page.data.tableId);
  let userId = $derived(page.data.userId);
  let requestId = $derived(page.url.searchParams.get('requestId'));

  let selected = $state(5); // d20 default
  let customExpr = $state('');
  let modifier = $state(0);
  let mode = $state<'normal' | 'advantage' | 'disadvantage'>('normal');
  let visibleToPlayers = $state(true);

  let result = $state<RollResult | null>(null);
  let rolling = $state(false);
  let error = $state('');
  let history: any[] = $state([]);
  let loading = $state(false);

  let expression = $derived(
    diceOptions[selected].label === 'Custom' ? customExpr : diceOptions[selected].expr
  );
  let isD20 = $derived(expression === '1d20');

  onMount(() => { loadHistory(); });

  async function loadHistory() {
    try {
      const res = await fetch(`/api/dice?tableId=${tableId}`);
      if (res.ok) history = await res.json();
    } catch {}
  }

  function doRoll() {
    error = '';
    try {
      rolling = true;
      result = parseAndRoll(expression, modifier, isD20 ? mode : 'normal');
      setTimeout(() => { rolling = false; }, 400);
    } catch (e: any) {
      error = e.message;
      result = null;
      rolling = false;
    }
  }

  async function saveRoll() {
    if (!result) return;
    loading = true;
    try {
      const res = await fetch('/api/dice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          requestId: requestId || null,
          rollType: diceOptions[selected].label,
          diceExpression: expression,
          modifier,
          mode: isD20 ? mode : 'normal',
          resultJson: result,
          visibleToPlayers,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        history.unshift(saved);
        result = null;
      }
    } finally { loading = false; }
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function rollDisplay(roll: any) {
    const r = roll.resultJson;
    if (!r) return '?';
    const mod = r.modifier ? (r.modifier >= 0 ? `+${r.modifier}` : `${r.modifier}`) : '';
    return `${r.total}${mod}`;
  }
</script>

<svelte:head>
  <title>Dice Roller</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
  <div class="flex items-center gap-3">
    <span class="text-2xl">🎲</span>
    <h1 class="text-xl font-bold text-stone-100">Dice Roller</h1>
  </div>

  <!-- Dice selection -->
  <div class="bg-stone-900 border border-stone-700 rounded-lg p-5 space-y-4">
    <!-- Quick dice buttons -->
    <div class="grid grid-cols-4 gap-2">
      {#each diceOptions as opt, i}
        <button
          onclick={() => { selected = i; result = null; }}
          class="px-3 py-2 rounded text-sm font-medium transition-all {selected === i
            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
            : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>

    <!-- Custom expression input -->
    {#if diceOptions[selected].label === 'Custom'}
      <input
        type="text"
        bind:value={customExpr}
        placeholder="e.g. 2d6, 4d8+2"
        class="w-full bg-stone-800 border border-stone-600 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
      />
    {/if}

    <!-- Modifier + Mode row -->
    <div class="flex gap-4 items-end">
      <div class="flex-1">
        <label class="text-xs text-stone-400 block mb-1">Modifier</label>
        <input
          type="number"
          bind:value={modifier}
          class="w-full bg-stone-800 border border-stone-600 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {#if isD20}
        <div class="flex gap-2">
          {#each ['normal', 'advantage', 'disadvantage'] as m}
            <button
              onclick={() => mode = m as any}
              class="px-3 py-2 text-xs font-medium rounded transition-all {mode === m
                ? 'bg-amber-700 text-amber-50'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-600'}"
            >
              {m === 'advantage' ? '⬆ Adv' : m === 'disadvantage' ? '⬇ Dis' : 'Normal'}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Visibility -->
    <label class="flex items-center gap-2 text-sm text-stone-400 cursor-pointer">
      <input type="checkbox" bind:checked={visibleToPlayers} class="rounded border-stone-600 bg-stone-800 text-amber-500 focus:ring-amber-500" />
      Visible to players
    </label>

    <!-- Roll button -->
    <button
      onclick={doRoll}
      disabled={rolling || !expression.trim()}
      class="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-700 disabled:text-stone-500 text-white font-semibold rounded-lg transition-all text-lg"
    >
      {rolling ? '🎲 Rolling...' : '🎲 Roll Dice'}
    </button>
  </div>

  <!-- Result display -->
  {#if error}
    <div class="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-300 text-sm">{error}</div>
  {/if}

  {#if result}
    <div class="bg-stone-900 border border-stone-700 rounded-lg p-6 text-center">
      <div class="text-5xl font-bold text-amber-400 mb-2 {rolling ? 'animate-pulse' : ''}">{result.total}</div>
      <p class="text-stone-400 text-sm">{formatResult(result)}</p>
      <div class="mt-4">
        <button
          onclick={saveRoll}
          disabled={loading}
          class="px-6 py-2 bg-green-700 hover:bg-green-600 disabled:bg-stone-600 disabled:text-stone-400 text-white text-sm font-medium rounded transition-all"
        >
          {loading ? 'Saving...' : '💾 Save Roll'}
        </button>
        <button
          onclick={() => { result = null; }}
          class="ml-2 px-4 py-2 text-stone-400 hover:text-stone-200 text-sm transition-all"
        >
          Dismiss
        </button>
      </div>
    </div>
  {/if}

  <!-- Roll history -->
  <div class="bg-stone-900 border border-stone-700 rounded-lg p-5">
    <h2 class="text-sm font-semibold text-stone-300 mb-3">Roll History</h2>
    {#if history.length === 0}
      <p class="text-stone-500 text-sm italic">No rolls yet</p>
    {:else}
      <div class="space-y-2 max-h-96 overflow-y-auto">
        {#each history as entry}
          <div class="flex items-center justify-between bg-stone-800/50 rounded px-3 py-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-stone-500">{entry.roll?.diceExpression || '?'}</span>
              {#if entry.roll?.modifierJson?.mode && entry.roll.modifierJson.mode !== 'normal'}
                <span class="text-xs text-amber-500/70">({entry.roll.modifierJson.mode})</span>
              {/if}
              {#if !entry.roll?.visibleToPlayers}
                <span class="text-xs text-stone-500">🔒</span>
              {/if}
            </div>
            <div class="flex items-center gap-3">
              <span class="font-bold text-amber-400">{rollDisplay(entry)}</span>
              <span class="text-stone-500 text-xs">{entry.roll?.created_by_user_id ? entry.roll.diceExpression : ''}</span>
              <span class="text-stone-600 text-xs">{formatTime(entry.roll?.createdAt)}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

