<script lang="ts">
  import { parseAndRoll, formatResult } from '$lib/dice';
  import type { RollResult } from '$lib/dice';

  let { onRoll, onClose }: { onRoll: (result: { rollType: string; diceExpression: string; modifier: number; resultJson: RollResult; visibleToPlayers: boolean }) => void; onClose: () => void } = $props();

  const rollTypes = [
    { label: 'd20', expression: '1d20', hasAdvantage: true },
    { label: 'd100', expression: '1d100', hasAdvantage: false },
    { label: 'Ability Check', expression: '1d20', hasAdvantage: true },
    { label: 'Skill Check', expression: '1d20', hasAdvantage: true },
    { label: 'Custom', expression: '', hasAdvantage: false },
  ];

  let selectedType = $state(0);
  let customExpression = $state('');
  let modifier = $state(0);
  let mode = $state<'normal' | 'advantage' | 'disadvantage'>('normal');
  let visibleToPlayers = $state(true);
  let result = $state<RollResult | null>(null);
  let rolling = $state(false);
  let error = $state('');

  let expression = $derived(
    rollTypes[selectedType].label === 'Custom' ? customExpression : rollTypes[selectedType].expression
  );
  let canAdvantage = $derived(rollTypes[selectedType].hasAdvantage);

  function doRoll() {
    error = '';
    try {
      rolling = true;
      result = parseAndRoll(expression, modifier, mode);
      setTimeout(() => { rolling = false; }, 400);
    } catch (e: any) {
      error = e.message;
      result = null;
      rolling = false;
    }
  }

  function submit() {
    if (!result) return;
    onRoll({
      rollType: rollTypes[selectedType].label,
      diceExpression: expression,
      modifier,
      resultJson: result,
      visibleToPlayers,
    });
    onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onclick={onClose}>
  <div class="bg-stone-900 border border-stone-700 rounded-lg p-6 w-full max-w-md mx-4" onclick={(e) => e.stopPropagation()}>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-semibold text-amber-400">🎲 Dice Roll</h2>
      <button onclick={onClose} class="text-stone-500 hover:text-stone-300 text-xl">&times;</button>
    </div>

    <!-- Roll type -->
    <div class="mb-3">
      <label class="text-xs text-stone-400 block mb-1">Roll Type</label>
      <select bind:value={selectedType} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm">
        {#each rollTypes as rt, i}
          <option value={i}>{rt.label}</option>
        {/each}
      </select>
    </div>

    <!-- Custom expression -->
    {#if rollTypes[selectedType].label === 'Custom'}
      <div class="mb-3">
        <label class="text-xs text-stone-400 block mb-1">Dice Expression</label>
        <input type="text" bind:value={customExpression} placeholder="e.g. 2d6, 4d8" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
      </div>
    {/if}

    <!-- Modifier -->
    <div class="mb-3">
      <label class="text-xs text-stone-400 block mb-1">Modifier</label>
      <input type="number" bind:value={modifier} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
    </div>

    <!-- Advantage/Disadvantage -->
    {#if canAdvantage}
      <div class="mb-3 flex gap-2">
        <label class="flex items-center gap-1.5 text-xs text-stone-400">
          <input type="radio" name="mode" value="normal" checked={mode === 'normal'} onchange={() => mode = 'normal'} /> Normal
        </label>
        <label class="flex items-center gap-1.5 text-xs text-stone-400">
          <input type="radio" name="mode" value="advantage" checked={mode === 'advantage'} onchange={() => mode = 'advantage'} /> Advantage
        </label>
        <label class="flex items-center gap-1.5 text-xs text-stone-400">
          <input type="radio" name="mode" value="disadvantage" checked={mode === 'disadvantage'} onchange={() => mode = 'disadvantage'} /> Disadvantage
        </label>
      </div>
    {/if}

    <!-- Visibility -->
    <div class="mb-4">
      <label class="flex items-center gap-1.5 text-xs text-stone-400">
        <input type="checkbox" bind:checked={visibleToPlayers} class="rounded" /> Visible to players
      </label>
    </div>

    <!-- Roll button -->
    <button onclick={doRoll} disabled={rolling || !expression.trim()}
      class="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-700 disabled:text-stone-500 text-white font-medium rounded mb-4 transition-all">
      {rolling ? '🎲 Rolling...' : '🎲 Roll'}
    </button>

    <!-- Result -->
    {#if error}
      <p class="text-red-400 text-sm mb-3">{error}</p>
    {/if}

    {#if result}
      <div class="bg-stone-800 border border-stone-700 rounded p-4 mb-4 text-center">
        <div class="text-3xl font-bold text-amber-400 mb-1 {rolling ? 'animate-pulse' : ''}">{result.total}</div>
        <p class="text-stone-400 text-sm">{formatResult(result)}</p>
      </div>
      <button onclick={submit} class="w-full px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded">
        Save Roll
      </button>
    {/if}
  </div>
</div>
