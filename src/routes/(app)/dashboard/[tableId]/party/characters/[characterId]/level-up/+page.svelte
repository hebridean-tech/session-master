<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let { data } = $props();
  const tableId = $derived(data.sheet?.tableId || '');
  const characterId = $derived(data.sheet?.id || '');
  const className = $derived(data.sheet?.characterClass || '');

  let step = $state(0);
  let loading = $state(true);
  let error = $state('');
  let committing = $state(false);

  // Step 0: Class selection
  let classSelectionMode = $state<'existing' | 'new' | null>(null);
  let selectedClassEntryId = $state<string | null>(null);
  let newClassName = $state('');
  let newSubclass = $state('');

  // API response data
  let levelData: any = $state(null);

  // Step 2: HP
  let hpChoice = $state<'roll' | 'average' | null>(null);
  let hpRoll = $state(0);
  let hpRolling = $state(false);
  let hpIncrease = $state(0);

  // AI feat suggestions
  let featSuggestions = $state<any[]>([]);
  let featSuggesting = $state(false);
  let featSuggestError = $state('');
  // Step 3: ASI
  let asiMode = $state<'stats' | 'feat' | null>(null);
  let asiStats = $state<Record<string, number>>({});
  let featName = $state('');

  async function suggestFeats() {
    featSuggesting = true;
    featSuggestError = '';
    try {
      const resp = await fetch('/api/characters/suggest-feats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterSheetId: characterId, tableId }),
      });
      const d = await resp.json();
      if (d.error) { featSuggestError = d.error; }
      else { featSuggestions = d.feats || []; }
    } catch (e: any) { featSuggestError = e.message; }
    featSuggesting = false;
  }

  function selectFeat(name: string) { featName = name; }

  // Step 4: Spell Slots
  let spellSlotsConfirmed = $state(false);

  // Step 5: New Features
  let featuresChecked = $state<Set<string>>(new Set());

  // Step 6: Fighting Style
  let chosenFightingStyle = $state('');

  async function fetchLevelData() {
    loading = true;
    error = '';
    try {
      const resp = await fetch('/api/characters/level-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterSheetId: characterId, newLevel: (data.sheet?.level || 0) + 1 }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        error = err.error || 'Failed to load level-up data';
        return;
      }
      levelData = await resp.json();
    } catch (e: any) {
      error = e.message || 'Network error';
    }
    loading = false;
  }

  fetchLevelData();

  function mod(score: number) { return Math.floor((score - 10) / 2); }
  function modStr(score: number) { const m = mod(score); return m >= 0 ? `+${m}` : `${m}`; }

  // HP rolling
  async function rollForHp() {
    hpRolling = true;
    hpChoice = 'roll';
    const hitDie = levelData?.hitDie || 8;
    // Animate dice roll
    for (let i = 0; i < 6; i++) {
      hpRoll = Math.floor(Math.random() * hitDie) + 1;
      await new Promise(r => setTimeout(r, 100));
    }
    hpIncrease = hpRoll + levelData.conMod;
    hpRolling = false;
  }

  function takeAverageHp() {
    hpChoice = 'average';
    hpIncrease = levelData.avgHpIncrease;
  }

  // Step computation
  const steps = $derived(() => {
    const s: { id: string; label: string; show: boolean }[] = [
      { id: 'class', label: 'Class', show: levelData?.hasClassEntries || true },
      { id: 'confirm', label: 'Confirm', show: true },
      { id: 'hp', label: 'Hit Points', show: true },
      { id: 'asi', label: 'ASI / Feat', show: levelData?.hasAsi },
      { id: 'spells', label: 'Spell Slots', show: levelData?.spellcaster },
      { id: 'features', label: 'New Features', show: (levelData?.newClassFeatures?.length || 0) + (levelData?.newSubclassFeatures?.length || 0) > 0 },
      { id: 'fighting', label: 'Fighting Style', show: !!levelData?.fightingStyleOptions?.length },
      { id: 'review', label: 'Review', show: true },
    ];
    return s.filter(x => x.show);
  });

  const visibleSteps = $derived(steps());

  function canProceed(): boolean {
    const current = visibleSteps[step];
    if (!current) return false;
    if (current.id === 'class') return classSelectionMode !== null;
    if (current.id === 'review') return true;
    if (current.id === 'asi' && levelData?.hasAsi) {
      if (asiMode === 'stats') {
        const total = Object.values(asiStats).reduce((a: number, b: number) => a + b, 0);
        return total === 2 && Object.keys(asiStats).length > 0;
      }
      if (asiMode === 'feat') return featName.trim().length > 0;
      return false;
    }
    if (current.id === 'spells') return spellSlotsConfirmed;
    if (current.id === 'fighting') return chosenFightingStyle.length > 0;
    return true;
  }

  function nextStep() {
    if (step < visibleSteps.length - 1) step++;
  }
  function prevStep() {
    if (step > 0) step--;
  }

  // ASI helpers
  function toggleAsiStat(stat: string) {
    const current = asiStats[stat] || 0;
    const totalBefore = Object.values(asiStats).reduce((a: number, b: number) => a + b, 0) - current;
    if (current > 0) {
      delete asiStats[stat];
    } else if (totalBefore < 2) {
      asiStats[stat] = 1;
    }
  }

  function getAsiPreviewScore(stat: string): number {
    return (levelData?.abilityScores[stat] || 10) + (asiStats[stat] || 0);
  }

  const HIT_DIE: Record<string, number> = {
    artificer: 8, bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
    fighter: 10, paladin: 10, ranger: 10,
    barbarian: 12, bloodhunter: 12,
    sorcerer: 6, wizard: 6,
  };
  function getCasterTypeSimple(name: string, sub: string | null): string | null {
    const c = name.toLowerCase(); const s = (sub || '').toLowerCase();
    if (c === 'fighter' && s.includes('eldritch knight')) return 'third';
    if (c === 'rogue' && s.includes('arcane trickster')) return 'third';
    if (c === 'fighter' || c === 'rogue') return null;
    if (['bard','cleric','druid','sorcerer','wizard','artificer'].includes(c)) return 'full';
    if (['paladin','ranger'].includes(c)) return 'half';
    if (c === 'warlock') return 'warlock';
    return null;
  }

  async function commit() {
    committing = true;
    error = '';
    try {
      const featuresToAddNotes = [...featuresChecked].map(key => {
        const allFeats = [...(levelData?.newClassFeatures || []), ...(levelData?.newSubclassFeatures || [])];
        return allFeats.find((f: any) => f.name === key);
      }).filter(Boolean);

      const body: any = {
        characterSheetId: characterId,
        classEntryId: selectedClassEntryId || undefined,
        newClassName: classSelectionMode === 'new' ? newClassName : undefined,
        newSubclass: classSelectionMode === 'new' ? (newSubclass || null) : undefined,
        newHitDie: classSelectionMode === 'new' ? (HIT_DIE[newClassName.toLowerCase()] || 8) : undefined,
        newCasterType: classSelectionMode === 'new' ? getCasterTypeSimple(newClassName, newSubclass || null) : undefined,
        hpIncrease,
        abilityScoreImprovements: asiMode === 'stats' && Object.keys(asiStats).length > 0 ? asiStats : undefined,
        newSpellSlots: levelData?.spellcaster ? levelData.newSpellSlots : undefined,
        featuresToAddNotes: featuresToAddNotes.length > 0 ? featuresToAddNotes : undefined,
        chosenFightingStyle: chosenFightingStyle || undefined,
      };

      const resp = await fetch('/api/characters/level-up/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json();
        error = err.error || 'Commit failed';
        committing = false;
        return;
      }
      goto(`/dashboard/${tableId}/party/characters/${characterId}`);
    } catch (e: any) {
      error = e.message || 'Network error';
    }
    committing = false;
  }
</script>

<div class="min-h-screen bg-stone-950">
  <div class="max-w-2xl mx-auto p-4 md:p-8">

    <!-- Back link -->
    <a href="/dashboard/{tableId}/party/characters/{characterId}"
       class="inline-flex items-center gap-1 text-stone-400 hover:text-stone-200 text-sm mb-6 transition-colors">
      ← Back to {data.sheet?.characterName}
    </a>

    <h1 class="text-2xl md:text-3xl font-bold text-stone-100 mb-2">Level Up</h1>

    {#if loading}
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
        <span class="ml-3 text-stone-400">Preparing level-up data…</span>
      </div>
    {:else if error && !levelData}
      <div class="bg-red-950/30 border border-red-800 rounded-lg p-4 text-red-300">{error}</div>
    {:else if levelData}

      <!-- Progress Bar -->
      <div class="flex items-center gap-1 mb-8">
        {#each visibleSteps as s, i}
          <button onclick={() => step = i}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              {i === step
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : i < step
                  ? 'bg-stone-800 text-amber-400 border border-amber-700/30'
                  : 'bg-stone-900 text-stone-500 border border-stone-800'}">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
              {i < step ? 'bg-amber-600 text-white' : i === step ? 'bg-white/20' : 'bg-stone-800'}">
              {i < step ? '✓' : i + 1}
            </span>
            <span class="hidden sm:inline">{s.label}</span>
          </button>
          {#if i < visibleSteps.length - 1}
            <div class="flex-1 h-px {i < step ? 'bg-amber-700/50' : 'bg-stone-800'}"></div>
          {/if}
        {/each}
      </div>

      <!-- Step Content -->
      {#if error}
        <div class="bg-red-950/30 border border-red-800 rounded-lg p-4 text-red-300 mb-4">{error}</div>
      {/if}

      {#if visibleSteps[step]?.id === 'class'}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-amber-400 mb-2">Choose Class to Level Up</h2>
          <p class="text-stone-400 text-sm mb-6">Which class gains this level?</p>

          {#if levelData.classEntries?.length > 0}
            <div class="space-y-2 mb-6">
              {#each levelData.classEntries as entry}
                <button onclick={() => { classSelectionMode = 'existing'; selectedClassEntryId = entry.id; }}
                  class="w-full p-4 rounded-lg border-2 text-left transition-all
                    {classSelectionMode === 'existing' && selectedClassEntryId === entry.id
                      ? 'border-amber-500 bg-amber-950/20'
                      : 'border-stone-700 bg-stone-800 hover:border-stone-600'}">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-stone-200 font-medium">{entry.className}{entry.subclass ? ` (${entry.subclass})` : ''}</p>
                      <p class="text-stone-500 text-xs">Level {entry.classLevel} → Level {entry.classLevel + 1}</p>
                    </div>
                    {#if entry.isPrimary}
                      <span class="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-400">Primary</span>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}

          <div class="border-t border-stone-800 pt-4">
            <button onclick={() => classSelectionMode = 'new'}
              class="w-full p-4 rounded-lg border-2 border-dashed transition-all text-left
                {classSelectionMode === 'new'
                  ? 'border-amber-500 bg-amber-950/20'
                  : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'}">
              <p class="text-stone-200 font-medium">+ Add New Class</p>
              <p class="text-stone-500 text-xs">Start at level 1 in a new class</p>
            </button>

            {#if classSelectionMode === 'new'}
              <div class="mt-4 space-y-3">
                <div>
                  <label class="block text-sm text-stone-400 mb-1">Class Name</label>
                  <input type="text" bind:value={newClassName} placeholder="e.g., Rogue"
                    class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-4 py-2 text-sm
                      focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30" />
                </div>
                <div>
                  <label class="block text-sm text-stone-400 mb-1">Subclass (optional)</label>
                  <input type="text" bind:value={newSubclass} placeholder="e.g., Thief"
                    class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-4 py-2 text-sm
                      focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30" />
                </div>
                {#if newClassName}
                  <p class="text-stone-500 text-xs">
                    Hit Die: d{HIT_DIE[newClassName.toLowerCase()] || 8} · Caster: {getCasterTypeSimple(newClassName, newSubclass || null) || 'None'}
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        </div>

      {:else if visibleSteps[step]?.id === 'confirm'}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-amber-400 mb-4">Level Up Confirmation</h2>
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-stone-400">Character</span>
              <span class="text-stone-200">{levelData.characterName}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-stone-400">Class</span>
              <span class="text-stone-200">{levelData.characterClass}{levelData.subclass ? ` (${levelData.subclass})` : ''}</span>
            </div>
            <div class="h-px bg-stone-800"></div>
            <div class="flex justify-between text-sm">
              <span class="text-stone-400">Current Level</span>
              <span class="text-stone-200">{levelData.currentLevel}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-stone-400">New Level</span>
              <span class="text-amber-400 font-bold text-lg">{levelData.newLevel}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-stone-400">Proficiency Bonus</span>
              <span class="text-stone-200">{levelData.proficiencyBonus} <span class="text-stone-500">(was {Math.floor((levelData.currentLevel - 1) / 4) + 2})</span></span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-stone-400">Hit Die</span>
              <span class="text-stone-200">d{levelData.hitDie}</span>
            </div>
          </div>
        </div>

      {:else if visibleSteps[step]?.id === 'hp'}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-amber-400 mb-4">Hit Points</h2>

          <div class="bg-stone-800/50 rounded-lg p-4 mb-6">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-stone-500">CON Modifier</span>
                <p class="text-stone-200 text-lg">{modStr(levelData.abilityScores.con || 10)}</p>
              </div>
              <div>
                <span class="text-stone-500">Hit Die</span>
                <p class="text-stone-200 text-lg">d{levelData.hitDie}</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-6">
            <button onclick={rollForHp} disabled={hpRolling}
              class="p-4 rounded-lg border-2 transition-all text-center
                {hpChoice === 'roll' ? 'border-amber-500 bg-amber-950/20' : 'border-stone-700 bg-stone-800 hover:border-stone-600'}
                disabled:opacity-50">
              <div class="text-2xl mb-1">🎲</div>
              <p class="text-stone-200 font-medium">Roll</p>
              {#if hpRolling}
                <div class="mt-2 text-amber-400 text-xl font-bold animate-pulse">{hpRoll}</div>
              {:else if hpChoice === 'roll'}
                <div class="mt-2 text-amber-400 text-xl font-bold">{hpRoll}</div>
              {/if}
            </button>

            <button onclick={takeAverageHp}
              class="p-4 rounded-lg border-2 transition-all text-center
                {hpChoice === 'average' ? 'border-amber-500 bg-amber-950/20' : 'border-stone-700 bg-stone-800 hover:border-stone-600'}">
              <div class="text-2xl mb-1">📊</div>
              <p class="text-stone-200 font-medium">Take Average</p>
              {#if hpChoice === 'average'}
                <div class="mt-2 text-amber-400 text-xl font-bold">{levelData.avgHpIncrease}</div>
              {:else}
                <div class="mt-2 text-stone-500 text-sm">({levelData.avgHpIncrease})</div>
              {/if}
            </button>
          </div>

          {#if hpChoice}
            <div class="bg-stone-800/50 rounded-lg p-4">
              <div class="flex justify-between text-sm mb-2">
                <span class="text-stone-400">Old HP Max</span>
                <span class="text-stone-200">{levelData.oldHpMax}</span>
              </div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-stone-400">HP Increase</span>
                <span class="text-green-400 font-medium">+{hpIncrease}</span>
              </div>
              <div class="h-px bg-stone-700 my-2"></div>
              <div class="flex justify-between text-sm">
                <span class="text-stone-300 font-medium">New HP Max</span>
                <span class="text-amber-400 font-bold text-lg">{levelData.oldHpMax + hpIncrease}</span>
              </div>
            </div>
          {/if}
        </div>

      {:else if visibleSteps[step]?.id === 'asi'}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-amber-400 mb-2">Ability Score Improvement</h2>
          <p class="text-stone-400 text-sm mb-6">Level {levelData.newLevel} grants an ASI. Choose how to improve.</p>

          <div class="grid grid-cols-2 gap-4 mb-6">
            <button onclick={() => asiMode = 'stats'}
              class="p-4 rounded-lg border-2 transition-all text-left
                {asiMode === 'stats' ? 'border-amber-500 bg-amber-950/20' : 'border-stone-700 bg-stone-800 hover:border-stone-600'}">
              <p class="text-stone-200 font-medium">Improve Ability Scores</p>
              <p class="text-stone-500 text-xs mt-1">+2 to one or +1 to two abilities</p>
            </button>
            <button onclick={() => asiMode = 'feat'}
              class="p-4 rounded-lg border-2 transition-all text-left
                {asiMode === 'feat' ? 'border-amber-500 bg-amber-950/20' : 'border-stone-700 bg-stone-800 hover:border-stone-600'}">
              <p class="text-stone-200 font-medium">Take a Feat</p>
              <p class="text-stone-500 text-xs mt-1">Choose any feat from the PHB</p>
            </button>
          </div>

          {#if asiMode === 'stats'}
            <p class="text-stone-400 text-xs mb-3">Points remaining: {2 - Object.values(asiStats).reduce((a: number, b: number) => a + b, 0)}</p>
            <div class="grid grid-cols-3 gap-2">
              {#each ['str','dex','con','int','wis','cha'] as stat}
                {@const current = levelData.abilityScores[stat] || 10}
                {@const preview = getAsiPreviewScore(stat)}
                {@const allocated = asiStats[stat] || 0}
                <button onclick={() => toggleAsiStat(stat)}
                  class="p-3 rounded-lg border-2 text-center transition-all
                    {allocated > 0 ? 'border-amber-500 bg-amber-950/20' : 'border-stone-700 bg-stone-800 hover:border-stone-600'}
                    {current >= 20 && allocated === 0 ? 'opacity-50' : ''}">
                  <p class="text-stone-500 text-xs uppercase">{stat}</p>
                  <p class="text-lg font-bold {allocated > 0 ? 'text-amber-400' : 'text-stone-200'}">
                    {preview}
                    {#if allocated > 0}
                      <span class="text-green-400 text-xs ml-1">+{allocated}</span>
                    {/if}
                  </p>
                  <p class="text-stone-500 text-xs">{modStr(preview)} mod</p>
                </button>
              {/each}
            </div>
          {:else if asiMode === 'feat'}
            <label class="block text-sm text-stone-400 mb-2">Feat Name</label>
            <input type="text" bind:value={featName} placeholder="e.g., Sharpshooter"
              class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-4 py-2 text-sm
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30" />
            <button onclick={suggestFeats} disabled={featSuggesting}
              class="mt-3 w-full px-4 py-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/40 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {featSuggesting ? '✨ Thinking...' : '✨ AI Suggest Feats'}
            </button>
            {#if featSuggestError}
              <p class="text-red-400 text-xs mt-2">{featSuggestError}</p>
            {/if}
            {#if featSuggestions.length > 0}
              <div class="mt-3 space-y-2">
                {#each featSuggestions as feat}
                  <button type="button" onclick={() => selectFeat(feat.name)}
                    class="w-full text-left bg-stone-800/80 border border-stone-700 rounded-lg p-3 hover:border-amber-600 transition-colors {featName === feat.name ? 'border-amber-500 bg-amber-950/20' : ''}">
                    <div class="flex items-center justify-between">
                      <span class="text-stone-100 font-medium text-sm">{feat.name}</span>
                      {#if feat.stat}
                        <span class="text-xs text-stone-500">{feat.stat}</span>
                      {/if}
                    </div>
                    <p class="text-stone-400 text-xs mt-1">{feat.reason}</p>
                  </button>
                {/each}
              </div>
            {/if}
          {/if}
        </div>

      {:else if visibleSteps[step]?.id === 'spells'}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-amber-400 mb-2">Spell Slots</h2>
          <p class="text-stone-400 text-sm mb-1">
            {levelData.casterType === 'warlock' ? 'Pact Magic' :
             levelData.casterType === 'full' ? 'Full Caster' :
             levelData.casterType === 'half' ? 'Half Caster' : 'Third Caster'}
          </p>
          <p class="text-stone-500 text-xs mb-6">These are your new spell slots at level {levelData.newLevel}.</p>

          <div class="space-y-2">
            {#each levelData.newSpellSlots.filter((s: any) => s.max > 0) as slot}
              <div class="flex items-center justify-between bg-stone-800/50 rounded-lg px-4 py-3">
                <span class="text-stone-300 text-sm font-medium">{slot.level}{slot.level === 1 ? 'st' : slot.level === 2 ? 'nd' : slot.level === 3 ? 'rd' : 'th'}-Level Slots</span>
                <span class="text-amber-400 font-bold">{slot.max}</span>
              </div>
            {/each}
            {#if levelData.newSpellSlots.filter((s: any) => s.max > 0).length === 0}
              <p class="text-stone-500 text-sm text-center py-4">No spell slots at this level.</p>
            {/if}
          </div>

          <label class="flex items-center gap-3 mt-6 cursor-pointer select-none">
            <input type="checkbox" bind:checked={spellSlotsConfirmed}
              class="w-4 h-4 rounded border-stone-600 bg-stone-800 text-amber-500 focus:ring-amber-500/30" />
            <span class="text-stone-300 text-sm">Spell slots look correct</span>
          </label>
        </div>

      {:else if visibleSteps[step]?.id === 'features'}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-amber-400 mb-2">New Features</h2>
          <p class="text-stone-400 text-sm mb-6">Features gained at level {levelData.newLevel}. Check the ones you want added to your character notes.</p>

          {#if levelData.newClassFeatures?.length > 0}
            <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Class Features</h3>
            <div class="space-y-3 mb-6">
              {#each levelData.newClassFeatures as feat}
                {@const key = feat.name}
                <label class="flex items-start gap-3 p-3 rounded-lg border border-stone-800 bg-stone-800/30 cursor-pointer hover:bg-stone-800/60 transition-colors">
                  <input type="checkbox" checked={featuresChecked.has(key)}
                    onchange={() => { if (featuresChecked.has(key)) featuresChecked.delete(key); else featuresChecked.add(key); }}
                    class="mt-0.5 w-4 h-4 rounded border-stone-600 bg-stone-800 text-amber-500 focus:ring-amber-500/30 flex-shrink-0" />
                  <div>
                    <p class="text-stone-200 font-medium text-sm">{feat.name}</p>
                    <p class="text-stone-400 text-xs mt-1">{feat.description}</p>
                  </div>
                </label>
              {/each}
            </div>
          {/if}

          {#if levelData.newSubclassFeatures?.length > 0}
            <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
              {levelData.subclass ? levelData.subclass : 'Subclass'} Features
            </h3>
            <div class="space-y-3">
              {#each levelData.newSubclassFeatures as feat}
                {@const key = feat.name}
                <label class="flex items-start gap-3 p-3 rounded-lg border border-stone-800 bg-stone-800/30 cursor-pointer hover:bg-stone-800/60 transition-colors">
                  <input type="checkbox" checked={featuresChecked.has(key)}
                    onchange={() => { if (featuresChecked.has(key)) featuresChecked.delete(key); else featuresChecked.add(key); }}
                    class="mt-0.5 w-4 h-4 rounded border-stone-600 bg-stone-800 text-amber-500 focus:ring-amber-500/30 flex-shrink-0" />
                  <div>
                    <p class="text-stone-200 font-medium text-sm">{feat.name}</p>
                    <p class="text-stone-400 text-xs mt-1">{feat.description}</p>
                  </div>
                </label>
              {/each}
            </div>
          {/if}
        </div>

      {:else if visibleSteps[step]?.id === 'fighting'}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-amber-400 mb-2">Fighting Style</h2>
          <p class="text-stone-400 text-sm mb-6">You gain a Fighting Style at this level. Choose one.</p>

          <div class="grid gap-2">
            {#each levelData.fightingStyleOptions as style}
              <button onclick={() => chosenFightingStyle = style}
                class="p-3 rounded-lg border-2 text-left transition-all
                  {chosenFightingStyle === style ? 'border-amber-500 bg-amber-950/20' : 'border-stone-700 bg-stone-800 hover:border-stone-600'}">
                <p class="text-stone-200 font-medium text-sm">{style}</p>
              </button>
            {/each}
          </div>
        </div>

      {:else if visibleSteps[step]?.id === 'review'}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-amber-400 mb-4">Review & Confirm</h2>

          <div class="space-y-4">
            <!-- Level change -->
            <div class="bg-stone-800/50 rounded-lg p-4">
              <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Level</h3>
              <div class="flex items-center gap-3">
                <span class="text-stone-200 text-lg">{levelData.currentLevel}</span>
                <span class="text-amber-500">→</span>
                <span class="text-amber-400 font-bold text-lg">{levelData.newLevel}</span>
                <span class="text-stone-500 text-sm ml-2">Proficiency: +{levelData.proficiencyBonus}</span>
              </div>
            </div>

            <!-- HP -->
            <div class="bg-stone-800/50 rounded-lg p-4">
              <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Hit Points</h3>
              <div class="flex items-center gap-3">
                <span class="text-stone-200">{levelData.oldHpMax} HP</span>
                <span class="text-green-400 font-medium">+{hpIncrease} ({hpChoice})</span>
                <span class="text-amber-400 font-bold">→ {levelData.oldHpMax + hpIncrease} HP</span>
              </div>
            </div>

            <!-- ASI -->
            {#if levelData.hasAsi}
              <div class="bg-stone-800/50 rounded-lg p-4">
                <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Ability Score Improvement</h3>
                {#if asiMode === 'stats'}
                  {#each Object.entries(asiStats) as [stat, bonus]}
                    <p class="text-stone-300 text-sm">
                      <span class="uppercase text-stone-500">{stat}</span> +{bonus}
                      → {getAsiPreviewScore(stat)} ({modStr(getAsiPreviewScore(stat))})
                    </p>
                  {/each}
                {:else if asiMode === 'feat'}
                  <p class="text-stone-300 text-sm">Feat: <span class="text-amber-400">{featName}</span></p>
                {/if}
              </div>
            {/if}

            <!-- Spell Slots -->
            {#if levelData.spellcaster}
              <div class="bg-stone-800/50 rounded-lg p-4">
                <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Spell Slots ({levelData.casterType} caster)</h3>
                <div class="flex flex-wrap gap-2">
                  {#each levelData.newSpellSlots.filter((s: any) => s.max > 0) as slot}
                    <span class="px-2 py-1 bg-stone-700 rounded text-xs text-stone-200">
                      {slot.level}: {slot.max}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Features -->
            {#if featuresChecked.size > 0}
              <div class="bg-stone-800/50 rounded-lg p-4">
                <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Features Added to Notes</h3>
                {#each [...featuresChecked] as name}
                  <p class="text-stone-300 text-sm">✨ {name}</p>
                {/each}
              </div>
            {/if}

            <!-- Fighting Style -->
            {#if chosenFightingStyle}
              <div class="bg-stone-800/50 rounded-lg p-4">
                <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Fighting Style</h3>
                <p class="text-stone-300 text-sm">⚔️ {chosenFightingStyle}</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Navigation -->
      <div class="flex justify-between mt-6">
        <button onclick={prevStep} disabled={step === 0}
          class="px-4 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          ← Back
        </button>
        <div class="flex gap-3">
          {#if step === visibleSteps.length - 1}
            <button onclick={commit} disabled={committing}
              class="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-colors disabled:opacity-50">
              {committing ? 'Completing…' : '⚡ Complete Level Up'}
            </button>
          {:else}
            <button onclick={nextStep} disabled={!canProceed()}
              class="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Next →
            </button>
          {/if}
        </div>
      </div>

    {/if}
  </div>
</div>
