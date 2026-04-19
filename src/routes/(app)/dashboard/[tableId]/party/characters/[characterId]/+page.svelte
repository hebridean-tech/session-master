<script lang="ts">
  let { data } = $props();
  let isDm = $derived(data?.role === 'dm');
  let canEdit = $derived(data.canEdit || isDm);
  let editing = $state(false);
  let dmNotesEditing = $state(false);
  let showDelete = $state(false);
  let deleting = $state(false);
  let showTransfer = $state(false);
  let transferring = $state(false);
  let transferTargetId = $state('');
  let transferError = $state('');
  const members = $derived(data?.members || []);
  let pdfParsing = $state(false);
  let pdfParsed = $state(false);
  let pdfApplying = $state(false);
  let pendingPdfData = $state<any>(null);
  let activeTab = $state('overview');

  let spells = $state(data.spells || []);
  let spellSlots = $state(data.spellSlots || []);
  let inventory = $state(data.inventory || []);
  let currency = $state(data.currency || { cp:0, sp:0, ep:0, gp:0, pp:0 });
  let classDisplay = $state('');

  const sheetId = $derived(data?.sheet?.id);
  const tableId = $derived(data?.table?.id || (typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '') || '');
  const s = $derived(data?.sheet);

  const scores = $derived(s.abilityScoresJson as Record<string, number> || {});

  // Fetch multi-class display string
  if (sheetId) {
    fetch(`/api/characters/classes?characterSheetId=${sheetId}`)
      .then(r => r.json())
      .then((entries: any[]) => {
        if (entries.length > 1) {
          classDisplay = entries.map((e: any) => `${e.className} ${e.classLevel}`).join(' / ');
        }
      }).catch(() => {});
  }
  function mod(score: number) { return Math.floor((score - 10) / 2); }
  function modStr(score: number) { const m = mod(score); return m >= 0 ? `+${m}` : `${m}`; }

  const partyLevel = $derived(data?.partyLevel ?? 1);
  const levelMismatch = $derived(s.level != null && s.level < partyLevel);

  async function handleDelete() {
    deleting = true;
    const resp = await fetch(`/api/characters?characterId=${sheetId}&tableId=${tableId}`, { method: 'DELETE' });
    if (resp.ok) {
      window.location.href = `/dashboard/${tableId}/party`;
    } else {
      const data = await resp.json();
      alert('Delete failed: ' + (data.error || 'Unknown error'));
    }
    deleting = false;
  }

  async function handleTransfer() {
    if (!transferTargetId) return;
    transferring = true;
    transferError = '';
    try {
      const resp = await fetch('/api/characters/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterSheetId: sheetId, targetUserId: transferTargetId, tableId }),
      });
      const d = await resp.json();
      if (d.error) { transferError = d.error; }
      else { window.location.reload(); }
    } catch (e: any) { transferError = e.message; }
    transferring = false;
  }

  async function handlePdfReupload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !sheetId) return;
    pdfParsing = true;
    pdfParsed = false;
    pendingPdfData = null;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tableId', tableId);
      formData.append('characterId', sheetId);
      const resp = await fetch('/api/characters/' + sheetId + '/update-pdf', { method: 'POST', body: formData });
      const result = await resp.json();
      if (result.success && result.data) {
        pendingPdfData = result.data;
        pdfParsed = true;
      } else {
        alert('Failed to parse PDF: ' + (result.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    pdfParsing = false;
    input.value = '';
  }

  async function applyPdfUpdate() {
    if (!pendingPdfData) return;
    pdfApplying = true;
    try {
      const resp = await fetch('/api/characters/' + sheetId + '/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, data: pendingPdfData }),
      });
      if (resp.ok) {
        window.location.reload();
      } else {
        const d = await resp.json();
        alert('Update failed: ' + (d.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    pdfApplying = false;
  }

  // Spells
  let newSpellName = $state('');
  let newSpellLevel = $state(0);
  let newSpellSchool = $state('');
  let newSpellPrepared = $state(false);
  async function addSpell() {
    if (!newSpellName.trim()) return;
    const resp = await fetch('/api/characters/spells', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterSheetId: sheetId, name: newSpellName.trim(), level: newSpellLevel, school: newSpellSchool || null, prepared: newSpellPrepared }),
    });
    if (resp.ok) { const spell = await resp.json(); spells = [...spells, spell]; newSpellName = ''; newSpellSchool = ''; newSpellPrepared = false; }
  }
  async function deleteSpell(id: string) {
    await fetch('/api/characters/spells', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, characterSheetId: sheetId }) });
    spells = spells.filter(sp => sp.id !== id);
  }

  // Spell slots
  async function saveSpellSlots() {
    const resp = await fetch('/api/characters/spell-slots', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterSheetId: sheetId, slots: spellSlots }),
    });
    if (resp.ok) spellSlots = await resp.json();
  }
  function getSlotForLevel(level: number) { return spellSlots.find(sl => sl.level === level); }

  // Inventory
  let newItemName = $state('');
  let newItemQty = $state(1);
  let newItemWeight = $state('');
  let newItemNotes = $state('');
  async function addItem() {
    if (!newItemName.trim()) return;
    const resp = await fetch('/api/characters/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterSheetId: sheetId, name: newItemName.trim(), quantity: newItemQty, itemType: 'misc', weight: newItemWeight ? parseFloat(newItemWeight) : null, description: newItemNotes || null }),
    });
    if (resp.ok) { const item = await resp.json(); inventory = [...inventory, item]; newItemName = ''; newItemQty = 1; newItemWeight = ''; newItemNotes = ''; }
  }
  async function deleteItem(id: string) {
    await fetch('/api/characters/inventory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, characterSheetId: sheetId }) });
    inventory = inventory.filter(it => it.id !== id);
  }
  const totalWeight = $derived(inventory.reduce((sum, it) => sum + (parseFloat(String(it.weight ?? 0)) * it.quantity), 0));

  // Currency
  async function saveCurrency() {
    const resp = await fetch('/api/characters/currency', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterSheetId: sheetId, cp: currency.cp, sp: currency.sp, ep: currency.ep, gp: currency.gp, pp: currency.pp }),
    });
    if (resp.ok) currency = await resp.json();
  }

  // HP bar
  const hpPercent = $derived(s.hpMax ? Math.max(0, Math.min(100, ((s.hpCurrent ?? 0) / s.hpMax) * 100)) : 0);
  const hpColor = $derived(hpPercent > 50 ? 'bg-green-600' : hpPercent > 25 ? 'bg-amber-600' : 'bg-red-600');

  // XP bar
  const xpPercent = $derived(s.xpToNextLevel ? Math.max(0, Math.min(100, (s.xp / s.xpToNextLevel) * 100)) : 0);

  const tabs = ['overview','abilities','spells','inventory','currency','notes'];
  const tabLabels: Record<string,string> = { overview:'Overview', abilities:'Abilities', spells:'Spells', inventory:'Inventory', currency:'Currency', notes:'Notes' };

  // Abilities editing state
  let skillProfs = $state((s.skillProficienciesJson as string[]) || []);
  let toolProfs = $state((s.toolProficienciesJson as string[]) || []);
  let langs = $state((s.languagesJson as string[]) || []);

  const allSkills = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];
  const skillAbility: Record<string,string> = { Acrobatics:'dex', 'Animal Handling':'wis', Arcana:'int', Athletics:'str', Deception:'cha', History:'int', Insight:'wis', Intimidation:'cha', Investigation:'int', Medicine:'wis', Nature:'int', Perception:'wis', Performance:'cha', Persuasion:'cha', Religion:'int', 'Sleight of Hand':'dex', Stealth:'dex', Survival:'wis' };
</script>

<div class="p-3 sm:p-4 md:p-8 min-h-screen bg-stone-950">
  <div class="max-w-4xl mx-auto">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-stone-100">{s.characterName}</h1>
        <p class="text-amber-500 text-sm mt-1">
          {s.characterClass}{s.subclass ? ` (${s.subclass})` : ''} {s.level}
          {#if classDisplay} · <span class="text-stone-300">{classDisplay}</span>{/if}
          {s.ancestryOrSpecies ? ` · ${s.ancestryOrSpecies}` : ''}
        </p>
        <p class="text-stone-500 text-xs mt-1">Played by {data.userName}</p>
      </div>
      <div class="flex gap-2 flex-shrink-0">
        {#if canEdit}
          <button onclick={() => editing = !editing} class="px-3 py-1.5 text-xs text-stone-300 hover:text-white border border-stone-700 rounded hover:border-stone-500 transition-colors">
            {editing ? '✕ Cancel' : '✏️ Edit'}
          </button>
        {/if}
        {#if isDm && !showDelete && !showTransfer}
          <button onclick={() => showTransfer = true} class="px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-900/50 rounded">Transfer</button>
        {/if}
        {#if showTransfer}
          <div class="flex items-center gap-2">
            <select bind:value={transferTargetId} class="text-xs bg-stone-800 border border-stone-600 text-stone-200 rounded px-2 py-1.5">
              <option value="">Select user...</option>
              {#each members as m}
                {#if m.user.id !== s.userId}
                  <option value={m.user.id}>{m.user.name || m.user.email}</option>
                {/if}
              {/each}
            </select>
            <button onclick={handleTransfer} disabled={transferring || !transferTargetId} class="px-3 py-1.5 text-xs bg-amber-700 hover:bg-amber-800 text-white rounded disabled:opacity-50">
              {transferring ? '…' : 'Confirm'}
            </button>
            <button onclick={() => { showTransfer = false; transferError = ''; }} class="px-3 py-1.5 text-xs text-stone-300 border border-stone-700 rounded">Cancel</button>
          </div>
          {#if transferError}
            <p class="text-xs text-red-400 mt-1">{transferError}</p>
          {/if}
        {/if}
        {#if canEdit && !showDelete}
          <button onclick={() => showDelete = true} class="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/50 rounded">Delete</button>
        {/if}
        {#if showDelete}
          <button onclick={handleDelete} disabled={deleting} class="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-800 text-white rounded disabled:opacity-50">
            {deleting ? '…' : 'Confirm'}
          </button>
          <button onclick={() => showDelete = false} class="px-3 py-1.5 text-xs text-stone-300 border border-stone-700 rounded">Cancel</button>
        {/if}
      </div>
    </div>

    <!-- Conditions -->
    {#if s.conditionActiveJson && (s.conditionActiveJson as string[]).length > 0}
      <div class="flex gap-2 flex-wrap mb-4">
        {#each (s.conditionActiveJson as string[]) as c}
          <span class="px-2 py-0.5 bg-red-900/50 text-red-300 text-xs rounded-full border border-red-800/30">{c}</span>
        {/each}
      </div>
    {/if}

    <!-- Level Up Available -->
    {#if levelMismatch}
      <a href="/dashboard/{tableId}/party/characters/{s.id}/level-up" class="block bg-emerald-950/30 border border-emerald-600 rounded-lg p-3 mb-4 hover:bg-emerald-950/50 transition-colors">
        <p class="text-emerald-300 font-medium text-sm">⬆️ Level Up Available!</p>
        <p class="text-emerald-400/70 text-xs mt-0.5">Your character is level {s.level} while the party is level {partyLevel}. Time to catch up!</p>
      </a>
    {/if}

    <!-- Action Buttons -->
    <div class="flex flex-col sm:flex-row gap-2 mb-4">
      {#if canEdit && s.level != null && s.level < 20}
        <a href="/dashboard/{tableId}/party/characters/{sheetId}/level-up"
          class="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors min-h-[44px]">
          ⬆️ Level Up
        </a>
      {/if}
      <a href="/dashboard/{tableId}/party/characters/{sheetId}/combat"
        class="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-sm font-medium transition-colors min-h-[44px]">
        ⚔️ Combat
      </a>
      {#if canEdit}
        <label class="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-sm font-medium transition-colors min-h-[44px] cursor-pointer">
          📄 Re-upload PDF
          <input type="file" accept=".pdf" class="hidden" onchange={handlePdfReupload} />
        </label>
      {/if}
    </div>

    {#if pdfParsing}
      <div class="bg-stone-900 border border-amber-800/50 rounded-lg p-4 mb-4">
        <p class="text-amber-400 text-sm">🔄 Parsing PDF with AI...</p>
      </div>
    {/if}

    {#if pdfParsed && canEdit}
      <div class="bg-stone-900 border border-amber-800/50 rounded-lg p-4 mb-4">
        <p class="text-amber-300 text-sm font-medium mb-2">PDF parsed — confirm update?</p>
        <p class="text-stone-400 text-xs mb-3">This will overwrite stats, spells, inventory, currency, and class entries.</p>
        <div class="flex gap-2">
          <button onclick={applyPdfUpdate} disabled={pdfApplying} class="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded disabled:opacity-50">Apply Update</button>
          <button onclick={() => { pdfParsed = null; pendingPdfData = null; }} class="px-3 py-2 text-stone-400 text-sm border border-stone-700 rounded hover:text-stone-200">Cancel</button>
        </div>
      </div>
    {/if}

    <!-- Tab Bar -->
    <div class="flex gap-1 mb-6 border-b border-stone-800 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-none">
      {#each tabs as t}
        <button onclick={() => activeTab = t}
          class="px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px min-h-[44px] flex items-center
            {activeTab === t ? 'text-amber-500 border-amber-500' : 'text-stone-500 border-transparent hover:text-stone-300'}">
          {tabLabels[t]}
        </button>
      {/each}
    </div>

    <!-- Edit Form (wraps overview+abilities) -->
    <form method="POST" action="?/update">
      {#if activeTab === 'overview'}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Combat Stats Card -->
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5 space-y-4">
            <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Combat</h2>

            <!-- HP -->
            <div>
              <label class="block text-xs text-stone-500 mb-1">Hit Points</label>
              {#if editing}
                <div class="flex gap-2 items-center">
                  <input name="hpCurrent" type="number" value={s.hpCurrent || 0} min="0"
                    class="w-20 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm text-center" />
                  <span class="text-stone-600">/</span>
                  <input name="hpMax" type="number" value={s.hpMax || 0} min="0"
                    class="w-20 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm text-center" />
                </div>
              {:else}
                <div>
                  <div class="flex justify-between text-xs text-stone-400 mb-1">
                    <span>{s.hpCurrent ?? 0} / {s.hpMax ?? 0}</span>
                    <span>{Math.round(hpPercent)}%</span>
                  </div>
                  <div class="w-full bg-stone-800 rounded-full h-3 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-300 {hpColor}" style="width: {hpPercent}%"></div>
                  </div>
                </div>
              {/if}
            </div>

            <!-- AC -->
            <div class="flex gap-6">
              <div>
                <label class="block text-xs text-stone-500 mb-1">AC</label>
                {#if editing}
                  <input name="ac" type="number" value={s.ac || 10} min="0"
                    class="w-20 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm text-center" />
                {:else}
                  <span class="text-2xl font-bold text-stone-100">{s.ac ?? '—'}</span>
                {/if}
              </div>
              <div>
                <label class="block text-xs text-stone-500 mb-1">Speed</label>
                {#if editing}
                  <input name="speed" type="number" value={s.speed || 30} min="0"
                    class="w-20 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm text-center" />
                {:else}
                  <span class="text-2xl font-bold text-stone-100">{s.speed ?? '—'}<span class="text-sm font-normal text-stone-500"> ft</span></span>
                {/if}
              </div>
              <div>
                <label class="block text-xs text-stone-500 mb-1">Prof. Bonus</label>
                {#if editing}
                  <input name="proficiencyBonus" type="number" value={s.proficiencyBonus || 2} min="0"
                    class="w-20 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm text-center" />
                {:else}
                  <span class="text-2xl font-bold text-amber-500">+{s.proficiencyBonus ?? 2}</span>
                {/if}
              </div>
            </div>
          </div>

          <!-- XP Card -->
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5 space-y-4">
            <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Experience</h2>
            {#if editing}
              <div class="flex gap-2 items-center">
                <div>
                  <label class="block text-xs text-stone-500 mb-1">Current XP</label>
                  <input name="xp" type="number" value={s.xp || 0} min="0"
                    class="w-28 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-stone-500 mb-1">XP to Next</label>
                  <input name="xpToNextLevel" type="number" value={s.xpToNextLevel || 300} min="0"
                    class="w-28 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
                </div>
              </div>
            {:else}
              <div>
                <div class="flex justify-between text-xs text-stone-400 mb-1">
                  <span>{s.xp ?? 0} / {s.xpToNextLevel ?? '?'} XP</span>
                  <span>Level {s.level}</span>
                </div>
                <div class="w-full bg-stone-800 rounded-full h-2.5 overflow-hidden">
                  <div class="h-full rounded-full bg-amber-600 transition-all duration-300" style="width: {xpPercent}%"></div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Character Info Card -->
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5 md:col-span-2">
            <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Character Info</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              {#each [
                { label:'Name', key:'characterName', val: s.characterName },
                { label:'Class', key:'characterClass', val: s.characterClass },
                { label:'Subclass', key:'subclass', val: s.subclass || '' },
                { label:'Level', key:'level', val: String(s.level), type:'number' },
                { label:'Species', key:'ancestryOrSpecies', val: s.ancestryOrSpecies },
                { label:'Background', key:'background', val: s.background || '' },
                { label:'Alignment', key:'alignment', val: s.alignment || '' },
              ] as field}
                <div>
                  <label class="block text-xs text-stone-500 mb-1">{field.label}</label>
                  {#if editing}
                    <input name={field.key} value={field.val} type={field.type || 'text'}
                      class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
                  {:else}
                    <p class="text-stone-200 text-sm">{field.val || '—'}</p>
                  {/if}
                </div>
              {/each}
            </div>

            {#if editing}
              <div class="mt-4">
                <label class="block text-xs text-stone-500 mb-1">Active Conditions</label>
                <input name="conditions" type="text"
                  value={(s.conditionActiveJson as string[] || []).join(', ')}
                  placeholder="Comma-separated"
                  class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if activeTab === 'abilities'}
        <div class="space-y-4">
          <!-- Ability Scores -->
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Ability Scores</h2>
            <div class="grid grid-cols-3 md:grid-cols-6 gap-4">
              {#each [{key:'str',label:'STR'},{key:'dex',label:'DEX'},{key:'con',label:'CON'},{key:'int',label:'INT'},{key:'wis',label:'WIS'},{key:'cha',label:'CHA'}] as ab}
                <div class="text-center">
                  <label class="block text-xs text-stone-500 mb-1">{ab.label}</label>
                  <div class="bg-stone-800 border border-stone-700 rounded-lg py-3 px-2 relative">
                    {#if editing}
                      <input name="score_{ab.key}" type="number" value={scores[ab.key] || 10} min="1" max="30"
                        class="w-full bg-transparent text-stone-200 text-xl font-bold text-center outline-none" />
                    {:else}
                      <span class="text-xl font-bold text-stone-100">{scores[ab.key] || 10}</span>
                    {/if}
                  </div>
                  <div class="mt-2 bg-amber-600/20 rounded px-2 py-1">
                    <span class="text-amber-500 text-sm font-bold">{modStr(scores[ab.key] || 10)}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Saving Throws -->
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Saving Throws</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
              {#each ['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'] as name}
                <div class="flex items-center gap-2 text-sm">
                  <span class="text-amber-500 font-medium w-8 text-right">{modStr(scores[name.slice(0,3).toLowerCase()] || 10)}</span>
                  <span class="text-stone-300">{name}</span>
                </div>
              {/each}
            </div>
          </div>

          <!-- Skills -->
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Skills</h2>
            <div class="space-y-1">
              {#each allSkills as skill}
                {@const ability = skillAbility[skill]}
                {@const score = scores[ability] || 10}
                {@const isProf = skillProfs.includes(skill)}
                {@const bonus = isProf ? (s.proficiencyBonus || 2) : 0}
                <div class="flex items-center gap-2 text-sm py-1">
                  {#if editing}
                    <button type="button" onclick={() => { if (isProf) skillProfs = skillProfs.filter(x => x !== skill); else skillProfs = [...skillProfs, skill]; }}
                      class="w-4 h-4 rounded border {isProf ? 'bg-amber-600 border-amber-500' : 'border-stone-600'} flex items-center justify-center flex-shrink-0">
                      {#if isProf}<span class="text-white text-xs">✓</span>{/if}
                    </button>
                  {:else}
                    {#if isProf}
                      <span class="w-4 h-4 rounded bg-amber-600/30 flex items-center justify-center flex-shrink-0"><span class="text-amber-500 text-xs">✓</span></span>
                    {:else}
                      <span class="w-4 flex-shrink-0"></span>
                    {/if}
                  {/if}
                  <span class="text-amber-500 font-medium w-8 text-right">{modStr(score + bonus)}</span>
                  <span class="text-stone-300">{skill}</span>
                  <span class="text-stone-600 text-xs">({ability.slice(0,3).toUpperCase()})</span>
                </div>
              {/each}
            </div>
          </div>

          <!-- Tools & Languages -->
          {#if editing}
            <div class="bg-stone-900 border border-stone-800 rounded-lg p-5 space-y-3">
              <div>
                <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Tool Proficiencies</h2>
                <input type="text" value={toolProfs.join(', ')}
                  oninput={(e) => toolProfs = (e.currentTarget as HTMLInputElement).value.split(',').map(x => x.trim()).filter(Boolean)}
                  class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" placeholder="Comma-separated" />
              </div>
              <div>
                <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Languages</h2>
                <input type="text" value={langs.join(', ')}
                  oninput={(e) => langs = (e.currentTarget as HTMLInputElement).value.split(',').map(x => x.trim()).filter(Boolean)}
                  class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" placeholder="Comma-separated" />
              </div>
              <!-- Hidden fields to pass to form -->
              <input type="hidden" name="skillProfsJson" value={JSON.stringify(skillProfs)} />
              <input type="hidden" name="toolProfsJson" value={JSON.stringify(toolProfs)} />
              <input type="hidden" name="languagesJson" value={JSON.stringify(langs)} />
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
                <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Tool Proficiencies</h2>
                {#if toolProfs.length > 0}
                  <div class="flex gap-2 flex-wrap">
                    {#each toolProfs as t}<span class="px-2 py-0.5 bg-stone-800 text-stone-300 text-xs rounded-full">{t}</span>{/each}
                  </div>
                {:else}
                  <p class="text-stone-600 text-sm">None recorded</p>
                {/if}
              </div>
              <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
                <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Languages</h2>
                {#if langs.length > 0}
                  <div class="flex gap-2 flex-wrap">
                    {#each langs as l}<span class="px-2 py-0.5 bg-stone-800 text-stone-300 text-xs rounded-full">{l}</span>{/each}
                  </div>
                {:else}
                  <p class="text-stone-600 text-sm">None recorded</p>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if editing && (activeTab === 'overview' || activeTab === 'abilities')}
        <div class="mt-4 flex gap-2">
          <button type="submit" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors">💾 Save Character</button>
        </div>
      {/if}
    </form>

    {#if activeTab === 'spells'}
      <div class="space-y-4">
        <!-- Spell Slots -->
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
          <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Spell Slots</h2>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            {#each [1,2,3,4,5,6,7,8,9] as lvl}
              {@const slot = getSlotForLevel(lvl)}
              <div class="text-center">
                <label class="block text-xs text-stone-500 mb-1">{lvl}{lvl===1?'st':lvl===2?'nd':lvl===3?'rd':'th'} Level</label>
                <div class="flex gap-1 justify-center items-center">
                  <input type="number" min="0" value={slot?.current ?? 0}
                    onchange={(e) => { if (slot) slot.current = parseInt((e.currentTarget as HTMLInputElement).value) || 0; }}
                    class="w-14 bg-stone-800 border border-stone-700 text-amber-500 rounded px-1 py-1 text-sm text-center" />
                  <span class="text-stone-600">/</span>
                  <input type="number" min="0" value={slot?.max ?? 0}
                    onchange={(e) => { if (slot) slot.max = parseInt((e.currentTarget as HTMLInputElement).value) || 0; }}
                    class="w-14 bg-stone-800 border border-stone-700 text-stone-200 rounded px-1 py-1 text-sm text-center" />
                </div>
              </div>
            {/each}
          </div>
          <button onclick={saveSpellSlots} class="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded transition-colors">Save Slots</button>
        </div>

        <!-- Add Spell -->
        {#if canEdit}
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Add Spell</h2>
            <div class="flex flex-wrap gap-2 items-end">
              <div class="flex-1 min-w-[140px]">
                <label class="block text-xs text-stone-500 mb-1">Name</label>
                <input bind:value={newSpellName} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" placeholder="Fireball" />
              </div>
              <div class="w-24">
                <label class="block text-xs text-stone-500 mb-1">Level</label>
                <select bind:value={newSpellLevel} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm">
                  <option value={0}>Cantrip</option>
                  {#each [1,2,3,4,5,6,7,8,9] as l}<option value={l}>{l}</option>{/each}
                </select>
              </div>
              <div class="w-28">
                <label class="block text-xs text-stone-500 mb-1">School</label>
                <input bind:value={newSpellSchool} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" placeholder="Evocation" />
              </div>
              <label class="flex items-center gap-1 text-xs text-stone-400">
                <input type="checkbox" bind:checked={newSpellPrepared} class="rounded" />
                Prepared
              </label>
              <button onclick={addSpell} class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded">Add</button>
            </div>
          </div>
        {/if}

        <!-- Spells by Level -->
        {#each [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as spellLevel}
          {@const levelSpells = spells.filter(sp => sp.level === spellLevel).sort((a,b) => a.name.localeCompare(b.name))}
          {#if spellLevel === -1}
            {@const cantrips = spells.filter(sp => sp.level === 0)}
            {#if cantrips.length > 0}
              <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
                <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Cantrips ({cantrips.length})</h2>
                <div class="space-y-1">
                  {#each cantrips as sp}
                    <div class="flex items-center justify-between py-1">
                      <div class="flex items-center gap-2">
                        {#if sp.prepared}<span class="text-amber-500 text-xs">✦</span>{/if}
                        <span class="text-stone-200 text-sm">{sp.name}</span>
                        {#if sp.school}<span class="text-stone-600 text-xs">{sp.school}</span>{/if}
                      </div>
                      {#if canEdit}
                        <button onclick={() => deleteSpell(sp.id)} class="text-red-500/50 hover:text-red-400 text-xs">✕</button>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {:else if levelSpells.length > 0}
            <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
              <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">{spellLevel}{spellLevel===1?'st':spellLevel===2?'nd':spellLevel===3?'rd':'th'} Level ({levelSpells.length})</h2>
              <div class="space-y-1">
                {#each levelSpells as sp}
                  <div class="flex items-center justify-between py-1">
                    <div class="flex items-center gap-2">
                      {#if sp.prepared}<span class="text-amber-500 text-xs">✦</span>{/if}
                      <span class="text-stone-200 text-sm">{sp.name}</span>
                      {#if sp.school}<span class="text-stone-600 text-xs">{sp.school}</span>{/if}
                    </div>
                    {#if canEdit}
                      <button onclick={() => deleteSpell(sp.id)} class="text-red-500/50 hover:text-red-400 text-xs">✕</button>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/each}

        {#if spells.length === 0}
          <p class="text-stone-600 text-sm text-center py-8">No spells recorded</p>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'inventory'}
      <div class="space-y-4">
        <!-- Add Item -->
        {#if canEdit}
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Add Item</h2>
            <div class="flex flex-wrap gap-2 items-end">
              <div class="flex-1 min-w-[140px]">
                <input bind:value={newItemName} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" placeholder="Item name" />
              </div>
              <div class="w-20">
                <input type="number" bind:value={newItemQty} min="1" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm text-center" placeholder="Qty" />
              </div>
              <div class="w-20">
                <input bind:value={newItemWeight} type="number" step="0.1" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm text-center" placeholder="Weight" />
              </div>
              <div class="flex-1 min-w-[120px]">
                <input bind:value={newItemNotes} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" placeholder="Notes" />
              </div>
              <button onclick={addItem} class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded">Add</button>
            </div>
          </div>
        {/if}

        <!-- Items List -->
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
          {#if inventory.length > 0}
            <div class="space-y-2">
              {#each inventory as item}
                <div class="flex items-center justify-between py-2 border-b border-stone-800/50 last:border-0">
                  <div class="flex items-center gap-3">
                    {#if item.magic}<span class="text-purple-400 text-xs">✦</span>{/if}
                    <span class="text-stone-200 text-sm">{item.name}</span>
                    {#if item.quantity > 1}<span class="text-stone-500 text-xs">×{item.quantity}</span>{/if}
                    {#if item.weight}<span class="text-stone-600 text-xs">{item.weight} lb</span>{/if}
                    {#if item.description}<span class="text-stone-600 text-xs">{item.description}</span>{/if}
                  </div>
                  {#if canEdit}
                    <button onclick={() => deleteItem(item.id)} class="text-red-500/50 hover:text-red-400 text-xs">✕</button>
                  {/if}
                </div>
              {/each}
            </div>
            <div class="mt-4 pt-3 border-t border-stone-700 flex justify-between text-xs">
              <span class="text-stone-500">Total Weight</span>
              <span class="text-stone-300 font-medium">{totalWeight.toFixed(1)} lb</span>
            </div>
          {:else}
            <p class="text-stone-600 text-sm text-center py-4">No items</p>
          {/if}
        </div>
      </div>
    {/if}

    {#if activeTab === 'currency'}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Currency</h2>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          {#each [
            { key:'cp', label:'Copper', color:'text-amber-800', icon:'🟤' },
            { key:'sp', label:'Silver', color:'text-stone-300', icon:'⚪' },
            { key:'ep', label:'Electrum', color:'text-amber-400', icon:'🟡' },
            { key:'gp', label:'Gold', color:'text-yellow-400', icon:'🪙' },
            { key:'pp', label:'Platinum', color:'text-violet-300', icon:'💎' },
          ] as coin}
            <div class="text-center">
              <label class="block text-xs text-stone-500 mb-1">{coin.icon} {coin.label}</label>
              <input type="number" min="0"
                value={currency[coin.key as keyof typeof currency]}
                onchange={(e) => { (currency as any)[coin.key] = parseInt((e.currentTarget as HTMLInputElement).value) || 0; }}
                class="w-full bg-stone-800 border border-stone-700 {coin.color} rounded px-2 py-2 text-center text-lg font-bold" />
            </div>
          {/each}
        </div>
        <button onclick={saveCurrency} class="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors">Save Currency</button>
        <div class="mt-4 pt-3 border-t border-stone-700 text-xs text-stone-500">
          Total: {currency.cp + currency.sp * 10 + currency.ep * 50 + currency.gp * 100 + currency.pp * 1000} CP
          ({currency.cp + currency.sp * 0.1 + currency.ep * 0.5 + currency.gp + currency.pp * 10} GP)
        </div>
      </div>
    {/if}

    {#if activeTab === 'notes'}
      <div class="space-y-4">
        <!-- Player Notes -->
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
          <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Player Notes</h2>
          {#if editing}
            <textarea name="notes" rows="4" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm">{s.notes || ''}</textarea>
          {:else}
            <p class="text-stone-300 text-sm whitespace-pre-wrap">{s.notes || 'No notes.'}</p>
          {/if}
        </div>

        <!-- DM Notes -->
        <div class="bg-stone-900 border border-amber-900/30 rounded-lg p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xs font-semibold text-amber-400 uppercase tracking-wider">🔒 DM Notes</h2>
            {#if isDm}
              <button onclick={() => dmNotesEditing = !dmNotesEditing} class="text-xs text-stone-400 hover:text-stone-200">
                {dmNotesEditing ? 'Cancel' : 'Edit'}
              </button>
            {/if}
          </div>
          {#if isDm || s.dmNotes}
            {#if dmNotesEditing}
              <form method="POST" action="?/updateDmNotes">
                <textarea name="dmNotes" rows="3" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm mb-2">{s.dmNotes || ''}</textarea>
                <button type="submit" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded">Save</button>
              </form>
            {:else}
              <p class="text-stone-300 text-sm whitespace-pre-wrap">{s.dmNotes || 'No DM notes.'}</p>
            {/if}
          {:else}
            <p class="text-stone-600 text-sm italic">Visible to DM only</p>
          {/if}
        </div>
      </div>
    {/if}

  </div>
</div>
