<script lang="ts">
  let { data } = $props();
  const safe_table = $derived(data?.table);

  let mode = $state<'manual' | 'upload'>('manual');
  let file = $state<File | null>(null);
  let parsing = $state(false);
  let parseError = $state('');
  let parseWarning = $state('');

  // Core fields
  let characterName = $state('');
  let characterClass = $state('');
  let subclass = $state('');
  let level = $state(1);
  let ancestryOrSpecies = $state('');
  let background = $state('');
  let alignment = $state('');

  // Combat stats
  let ac = $state('');
  let hpMax = $state('');
  let hpCurrent = $state('');
  let speed = $state('');
  let proficiencyBonus = $state('');
  let xp = $state('');

  // Ability scores
  let scores = $state({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  let skills = $state<string[]>([]);
  let languages = $state<string[]>([]);
  let tools = $state<string[]>([]);

  // Character details
  let personalityTraits = $state('');
  let ideals = $state('');
  let bonds = $state('');
  let flaws = $state('');
  let backstory = $state('');
  let notes = $state('');

  // Pending from upload (sent as hidden JSON)
  let pendingSpells = $state<any[]>([]);
  let pendingInventory = $state<any[]>([]);
  let pendingCurrency = $state<any>({});
  let pendingClasses = $state<any[]>([]);

  function fillFromParsed(p: Record<string, any>) {
    characterName = p.characterName || '';
    characterClass = p.characterClass || '';
    subclass = p.subclass || '';
    level = parseInt(p.level) || 1;
    // Store multi-class data for submission
    if (p.classes && Array.isArray(p.classes) && p.classes.length > 0) {
      pendingClasses = p.classes;
      // Back-compat: primary class into single-class fields
      const primary = p.classes.find((c: any) => c.isPrimary) || p.classes[0];
      characterClass = primary.className || '';
      subclass = primary.subclass || '';
      level = p.classes.reduce((sum: number, c: any) => sum + (parseInt(c.classLevel) || 0), 0);
    }
    ancestryOrSpecies = p.ancestryOrSpecies || '';
    background = p.background || '';
    alignment = p.alignment || '';
    ac = p.ac != null ? String(p.ac) : '';
    hpMax = p.hpMax != null ? String(p.hpMax) : '';
    hpCurrent = p.hpCurrent != null ? String(p.hpCurrent) : '';
    speed = p.speed != null ? String(p.speed) : '';
    proficiencyBonus = p.proficiencyBonus != null ? String(p.proficiencyBonus) : '';
    xp = p.xp != null ? String(p.xp) : '';
    if (p.abilityScores) {
      for (const k of ['str','dex','con','int','wis','cha'] as const) {
        scores[k] = p.abilityScores[k] || 10;
      }
    }
    skills = p.skillProficiencies || [];
    languages = p.languages || [];
    tools = p.toolProficiencies || [];
    personalityTraits = p.personalityTraits || '';
    ideals = p.ideals || '';
    bonds = p.bonds || '';
    flaws = p.flaws || '';
    backstory = p.backstory || '';
    pendingSpells = p.spells || [];
    pendingInventory = p.inventory || [];
    pendingCurrency = p.currency || {};
    mode = 'manual';
  }

  async function handleParse() {
    if (!file) return;
    parsing = true;
    parseError = '';
    parseWarning = '';
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tableId', safe_table?.id || '');
      const resp = await fetch('/api/characters/parse-pdf', { method: 'POST', body: formData });
      const result = await resp.json();
      if (!resp.ok) {
        parseError = result.error || 'Parse failed';
        parsing = false;
        return;
      }
      if (result.source === 'ai' && result.data) {
        fillFromParsed(result.data);
      } else if (result.source === 'raw') {
        parseWarning = 'AI not configured — review and fill in manually.';
        mode = 'manual';
      }
    } catch (e: any) {
      parseError = e.message || 'Upload failed';
    }
    parsing = false;
  }

  // Summary of what will be imported
  const spellCount = $derived(pendingSpells.length);
  const itemCount = $derived(pendingInventory.length);
  const hasCurrency = $derived(Object.values(pendingCurrency).some(v => v > 0));
</script>

<div class="p-8">
  <div class="max-w-2xl mx-auto">
    <a href="/dashboard/{safe_table?.id}/party" class="text-stone-500 text-sm hover:text-stone-300">← Back to party</a>
    <h1 class="text-2xl font-bold text-stone-100 mt-2 mb-6">New Character</h1>

    <!-- Mode selector -->
    <div class="grid grid-cols-2 gap-3 mb-6">
      <button
        onclick={() => mode = 'manual'}
        class="p-4 rounded-lg border text-left transition-colors {mode === 'manual'
          ? 'bg-stone-800 border-amber-600 text-stone-200'
          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'}">
        <p class="font-medium">✏️ Enter manually</p>
        <p class="text-xs mt-1 opacity-70">Fill in the form yourself</p>
      </button>
      <button
        onclick={() => mode = 'upload'}
        class="p-4 rounded-lg border text-left transition-colors {mode === 'upload'
          ? 'bg-stone-800 border-amber-600 text-stone-200'
          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'}">
        <p class="font-medium">📎 Upload PDF</p>
        <p class="text-xs mt-1 opacity-70">AI auto-fills everything from your sheet</p>
      </button>
    </div>

    {#if parseError}
      <div class="bg-red-900/30 border border-red-800 rounded p-3 text-red-300 text-sm mb-4">{parseError}</div>
    {/if}
    {#if parseWarning}
      <div class="bg-amber-950/30 border border-amber-800 rounded p-3 text-amber-300 text-sm mb-4">{parseWarning}</div>
    {/if}

    {#if spellCount > 0 || itemCount > 0 || hasCurrency}
      <div class="bg-emerald-950/30 border border-emerald-800 rounded p-3 text-emerald-300 text-sm mb-4">
        📦 Upload data loaded: {spellCount} spells, {itemCount} inventory items{hasCurrency ? ', currency' : ''}. Review below, then create.
      </div>
    {/if}

    {#if mode === 'upload'}
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-stone-400 mb-1">Character Sheet PDF</label>
          <input type="file" accept=".pdf,.txt" onchange={(e: Event) => { const t = e.target as HTMLInputElement; file = t.files?.[0] || null; }}
            class="block w-full text-sm text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-stone-800 file:text-stone-300 hover:file:bg-stone-700" />
          {#if file}
            <p class="text-stone-500 text-xs mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
          {/if}
        </div>
        <button onclick={handleParse} disabled={parsing || !file}
          class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded disabled:opacity-50">
          {parsing ? 'Parsing…' : '🤖 Parse Character Sheet'}
        </button>
        <p class="text-stone-600 text-xs text-center">AI will extract all data: stats, HP, AC, spells, inventory, currency, and more.</p>
      </div>
    {:else}
      <form method="POST" class="space-y-6">
        <!-- Hidden fields for upload data -->
        <input type="hidden" name="pendingSpells" value={JSON.stringify(pendingSpells)} />
        <input type="hidden" name="pendingInventory" value={JSON.stringify(pendingInventory)} />
        <input type="hidden" name="pendingCurrency" value={JSON.stringify(pendingCurrency)} />
        <input type="hidden" name="pendingClasses" value={JSON.stringify(pendingClasses)} />

        <!-- Basic Info -->
        <div>
          <h2 class="text-lg font-semibold text-stone-200 mb-3 border-b border-stone-800 pb-1">Basic Info</h2>
          <div class="space-y-3">
            <div>
              <label for="characterName" class="block text-sm font-medium text-stone-400 mb-1">Character Name *</label>
              <input id="characterName" name="characterName" type="text" required bind:value={characterName}
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="characterClass" class="block text-sm font-medium text-stone-400 mb-1">Class *</label>
                <input id="characterClass" name="characterClass" type="text" required bind:value={characterClass}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
              <div>
                <label for="subclass" class="block text-sm font-medium text-stone-400 mb-1">Subclass</label>
                <input id="subclass" name="subclass" type="text" bind:value={subclass}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label for="level" class="block text-sm font-medium text-stone-400 mb-1">Level</label>
                <input id="level" name="level" type="number" bind:value={level} min="1" max="20"
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
              <div>
                <label for="ancestryOrSpecies" class="block text-sm font-medium text-stone-400 mb-1">Species *</label>
                <input id="ancestryOrSpecies" name="ancestryOrSpecies" type="text" required bind:value={ancestryOrSpecies}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
              <div>
                <label for="alignment" class="block text-sm font-medium text-stone-400 mb-1">Alignment</label>
                <select id="alignment" name="alignment" bind:value={alignment}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600">
                  <option value="">—</option>
                  {#each ['LG','NG','CG','LN','N','CN','LE','NE','CE'] as a}
                    <option value={a}>{a}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="background" class="block text-sm font-medium text-stone-400 mb-1">Background</label>
                <input id="background" name="background" type="text" bind:value={background}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
              <div>
                <label for="proficiencyBonus" class="block text-sm font-medium text-stone-400 mb-1">Proficiency Bonus</label>
                <input id="proficiencyBonus" name="proficiencyBonus" type="number" bind:value={proficiencyBonus} min="0" max="10" placeholder="2"
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
            </div>
          </div>
        </div>

        <!-- Combat Stats -->
        <div>
          <h2 class="text-lg font-semibold text-stone-200 mb-3 border-b border-stone-800 pb-1">Combat</h2>
          <div class="grid grid-cols-4 gap-3">
            <div>
              <label for="ac" class="block text-sm font-medium text-stone-400 mb-1">AC</label>
              <input id="ac" name="ac" type="number" bind:value={ac} min="0" placeholder="10"
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm text-center focus:outline-none focus:border-amber-600" />
            </div>
            <div>
              <label for="hpMax" class="block text-sm font-medium text-stone-400 mb-1">Max HP</label>
              <input id="hpMax" name="hpMax" type="number" bind:value={hpMax} min="0" placeholder="10"
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm text-center focus:outline-none focus:border-amber-600" />
            </div>
            <div>
              <label for="hpCurrent" class="block text-sm font-medium text-stone-400 mb-1">Current HP</label>
              <input id="hpCurrent" name="hpCurrent" type="number" bind:value={hpCurrent} min="0" placeholder="10"
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm text-center focus:outline-none focus:border-amber-600" />
            </div>
            <div>
              <label for="speed" class="block text-sm font-medium text-stone-400 mb-1">Speed (ft)</label>
              <input id="speed" name="speed" type="number" bind:value={speed} min="0" placeholder="30"
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm text-center focus:outline-none focus:border-amber-600" />
            </div>
          </div>
          <div class="mt-3">
            <label for="xp" class="block text-sm font-medium text-stone-400 mb-1">XP</label>
            <input id="xp" name="xp" type="number" bind:value={xp} min="0" placeholder="0"
              class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
          </div>
        </div>

        <!-- Ability Scores -->
        <div>
          <h2 class="text-lg font-semibold text-stone-200 mb-3 border-b border-stone-800 pb-1">Ability Scores</h2>
          <div class="grid grid-cols-6 gap-2">
            {#each Object.entries(scores) as [key, val]}
              <div class="text-center">
                <label class="block text-xs text-stone-500 mb-1">{key.toUpperCase()}</label>
                <input name="score_{key}" type="number" bind:value={scores[key]} min="1" max="30"
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-1 py-1 text-sm text-center focus:outline-none focus:border-amber-600" />
                <p class="text-xs text-stone-500 mt-0.5">{Math.floor((val - 10) / 2) >= 0 ? '+' : ''}{Math.floor((val - 10) / 2)}</p>
              </div>
            {/each}
          </div>
        </div>

        <!-- Proficiencies -->
        <div>
          <h2 class="text-lg font-semibold text-stone-200 mb-3 border-b border-stone-800 pb-1">Proficiencies</h2>
          <div class="space-y-2">
            <div>
              <label class="block text-sm font-medium text-stone-400 mb-1">Skill Proficiencies</label>
              <input name="skillProficiencies" type="text" value={skills.join(', ')}
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-stone-400 mb-1">Languages</label>
                <input name="languages" type="text" value={languages.join(', ')}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
              <div>
                <label class="block text-sm font-medium text-stone-400 mb-1">Tool Proficiencies</label>
                <input name="toolProficiencies" type="text" value={tools.join(', ')}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
            </div>
          </div>
        </div>

        <!-- Character Details -->
        <div>
          <h2 class="text-lg font-semibold text-stone-200 mb-3 border-b border-stone-800 pb-1">Personality & Backstory</h2>
          <div class="space-y-2">
            <div>
              <label class="block text-sm font-medium text-stone-400 mb-1">Personality Traits</label>
              <input name="personalityTraits" type="text" bind:value={personalityTraits}
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-stone-400 mb-1">Ideals</label>
                <input name="ideals" type="text" bind:value={ideals}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
              <div>
                <label class="block text-sm font-medium text-stone-400 mb-1">Bonds</label>
                <input name="bonds" type="text" bind:value={bonds}
                  class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-400 mb-1">Flaws</label>
              <input name="flaws" type="text" bind:value={flaws}
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-400 mb-1">Backstory</label>
              <textarea name="backstory" bind:value={backstory} rows="3"
                class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600"></textarea>
            </div>
          </div>
        </div>

        <!-- Pending data preview -->
        {#if spellCount > 0}
          <div>
            <h2 class="text-lg font-semibold text-stone-200 mb-2 border-b border-stone-800 pb-1">📜 Spells ({spellCount})</h2>
            <div class="text-stone-400 text-xs max-h-32 overflow-y-auto space-y-0.5">
              {#each pendingSpells as spell}
                <p>{spell.name} (Lv {spell.level}){spell.prepared ? ' ★' : ''}</p>
              {/each}
            </div>
          </div>
        {/if}
        {#if itemCount > 0}
          <div>
            <h2 class="text-lg font-semibold text-stone-200 mb-2 border-b border-stone-800 pb-1">🎒 Inventory ({itemCount})</h2>
            <div class="text-stone-400 text-xs max-h-32 overflow-y-auto space-y-0.5">
              {#each pendingInventory as item}
                <p>{item.name} ×{item.quantity || 1}{item.isMagic ? ' ✨' : ''}</p>
              {/each}
            </div>
          </div>
        {/if}

        <div class="flex gap-3 pt-2">
          <button type="submit" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded">Create Character</button>
          <a href="/dashboard/{safe_table?.id}/party" class="px-5 py-2.5 text-stone-400 hover:text-stone-200 text-sm rounded border border-stone-700">Cancel</a>
        </div>
      </form>
    {/if}
  </div>
</div>
