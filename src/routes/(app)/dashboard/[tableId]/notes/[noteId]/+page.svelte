<script lang="ts">
  import { redirect } from '@sveltejs/kit';

  let { data } = $props();
    let editing = $state(false);
  let editTitle = $state(data.note.title);
  let editBody = $state(data.note.body);
  let editSessionLabel = $state(data.note.sessionLabel || '');
  let editVisibility = $state(data.note.visibility);
  let showDelete = $state(false);
  let saving = $state(false);
  let error = $state('');

  // AI states
  let summarizing = $state(false);
  let summaryResult = $state('');
  let summaryError = $state('');
  let extracting = $state(false);
  let extractionError = $state('');
  let mergeMode = $state(false);
  let mergeSource = $state('');
  let mergeTarget = $state('');
  let mergeResult = $state('');
  let merging = $state(false);
  let autoMerging = $state(false);
  let autoMergeResult = $state('');
  const allEntities = $derived(data?.entities || []);

  async function handleAutoMerge() {
    autoMerging = true;
    autoMergeResult = '';
    try {
      const ids = allEntities.map(e => e.id);
      const res = await fetch('/api/ai/entities/auto-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: data?.table.id, entityIds: ids }),
      });
      const d = await res.json();
      if (d.success) {
        autoMergeResult = d.merged.length > 0
          ? `Merged ${d.merged.length} pair(s): ${d.merged.map((m: any) => m.alias + ' → ' + m.primary).join(', ')}`
          : 'No duplicates found.';
        setTimeout(() => window.location.reload(), 2000);
      } else {
        autoMergeResult = 'Error: ' + (d.error || 'Unknown');
      }
    } catch (e: any) {
      autoMergeResult = 'Error: ' + e.message;
    }
    autoMerging = false;
  }
  let showEntities = $state(true);

  const isAuthor = data?.userId === data.note.authorUserId;
  const isDm = data?.role === 'dm';
  const canEdit = isAuthor;
  const canDelete = isAuthor || isDm;
  const aiEnabled = data.aiSettings !== null && data.aiSettings.permissionLevel >= 1;
  const aiDisabledReason = !data.aiSettings
    ? 'AI not configured — ask your DM to set up AI settings'
    : data.aiSettings.permissionLevel < 1
      ? `AI permission level too low (${data.aiSettings.permissionLevel}) — need 1+`
      : '';

  async function saveEdit() {
    saving = true; error = '';
    try {
      const resp = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: data.note.id,
          tableId: data?.table.id,
          title: editTitle.trim(),
          body: editBody.trim(),
          sessionLabel: editSessionLabel.trim() || null,
          visibility: editVisibility,
        }),
      });
      if (!resp.ok) { const e = await resp.json(); throw new Error(e.error || 'Save failed'); }
      editing = false;
      window.location.reload();
    } catch (e: any) { error = e.message; }
    saving = false;
  }

  async function handleDelete() {
    saving = true;
    try {
      const resp = await fetch(`/api/notes?noteId=${data.note.id}&tableId=${data?.table.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed');
      window.location.href = `/dashboard/${data?.table.id}/notes`;
    } catch (e: any) { error = e.message; }
    saving = false;
  }

  async function handleSummarize() {
    summarizing = true; summaryError = '';
    try {
      const res = await fetch('/api/ai/summarize-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: data.note.id, tableId: data?.table.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Summarization failed');
      summaryResult = json.summary;
    } catch (e: any) { summaryError = e.message; }
    summarizing = false;
  }

  async function handleExtractEntities() {
    extracting = true; extractionError = '';
    try {
      const res = await fetch('/api/ai/extract-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: data.note.id, tableId: data?.table.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Extraction failed');
      // Reload to get fresh entities
      window.location.reload();
    } catch (e: any) { extractionError = e.message; }
    extracting = false;
  }

  async function handleMergeEntities() {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    merging = true;
    mergeResult = '';
    try {
      const res = await fetch('/api/ai/entities/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: data?.table.id, entityId: mergeSource, aliasId: mergeTarget }),
      });
      const d = await res.json();
      if (d.success) {
        mergeResult = `Merged "${d.alias.name}" → "${d.primary.name}"`;
        mergeSource = '';
        mergeTarget = '';
        setTimeout(() => window.location.reload(), 1500);
      } else { mergeResult = 'Error: ' + (d.error || 'Unknown'); }
    } catch (e: any) { mergeResult = 'Error: ' + e.message; }
    merging = false;
  }

  const sourceBadge: Record<string, string> = {
    upload: 'bg-blue-900/50 text-blue-300',
    in_app: 'bg-green-900/50 text-green-300',
  };

  const entityTypeBadge: Record<string, string> = {
    NPC: 'bg-blue-900/50 text-blue-300',
    Location: 'bg-green-900/50 text-green-300',
    Quest: 'bg-amber-900/50 text-amber-300',
    Faction: 'bg-purple-900/50 text-purple-300',
    Item: 'bg-yellow-900/50 text-yellow-300',
    Rumor: 'bg-red-900/50 text-red-300',
  };

  function md(text: string) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gm, '<h3 class="text-stone-200 font-semibold text-base mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-stone-200 font-semibold text-lg mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-stone-200 font-bold text-xl mt-4 mb-2">$1</h1>')
      .replace(/\n/g, '<br>');
  }

  function formatBytes(b: number) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  // Group entities by type
  const entitiesByType = $derived(() => {
    const groups: Record<string, typeof data.entities> = {};
    for (const e of data.entities) {
      const t = e.entityType;
      if (!groups[t]) groups[t] = [];
      groups[t].push(e);
    }
    return groups;
  });

  const safe_note = $derived(data?.note);
  const safe_author = $derived(data?.author);
  const safe_files = $derived(data?.files);
  const safe_aiSettings = $derived(data?.aiSettings);
  const safe_entities = $derived(data?.entities);
</script>

<div class="p-8">
  <div class="max-w-2xl mx-auto">
    <a href="/dashboard/{data?.table.id}/notes" class="text-stone-500 text-sm hover:text-stone-300">← Back to notes</a>

    {#if !editing}
      <div class="mt-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs px-1.5 py-0.5 rounded {sourceBadge[safe_note.sourceType] || 'bg-stone-700 text-stone-400'}">
            {safe_note.sourceType === 'upload' ? '📎 Uploaded' : '✏️ Written in-app'}
          </span>
          {#if safe_note.visibility === 'dm_only'}
            <span class="text-xs px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">DM Only</span>
          {/if}
        </div>

        <h1 class="text-xl font-bold text-stone-100 mb-1">{safe_note.title}</h1>
        <p class="text-stone-500 text-sm mb-6">
          {safe_author.name || safe_author.email}
          {#if safe_note.sessionLabel} · Session: {safe_note.sessionLabel}{/if}
          · {new Date(safe_note.createdAt).toLocaleDateString()}
        </p>

        {#if safe_note.sourceType === 'in_app'}
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-5 mb-6">
            <div class="prose prose-invert prose-sm text-stone-300 leading-relaxed">
              {@html md(safe_note.body)}
            </div>
          </div>
        {:else if safe_files.length > 0}
          {#each safe_files as file (file.id)}
            <div class="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-3">
              <p class="text-stone-300 text-sm font-medium">{file.originalFilename}</p>
              <p class="text-stone-500 text-xs mt-1">{formatBytes(file.sizeBytes)} · {file.mimeType}</p>
              <a href="/api/notes/{safe_note.id}/files/{file.id}" target="_blank"
                class="inline-block mt-2 text-amber-400 text-sm hover:text-amber-300">Download file →</a>
            </div>
          {/each}
        {/if}

        <!-- AI Actions Bar -->
        {#if aiEnabled}
          <div class="flex gap-2 mt-2 mb-4">
            <button
              onclick={handleSummarize}
              disabled={summarizing}
              class="px-3 py-1.5 bg-amber-700/50 hover:bg-amber-700 text-amber-200 text-sm rounded border border-amber-800/50 disabled:opacity-50 flex items-center gap-1.5">
              {#if summarizing}
                <span class="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full"></span>
                Summarizing…
              {:else}
                🤖 Summarize Note
              {/if}
            </button>
            <button
              onclick={handleExtractEntities}
              disabled={extracting}
              class="px-3 py-1.5 bg-amber-700/50 hover:bg-amber-700 text-amber-200 text-sm rounded border border-amber-800/50 disabled:opacity-50 flex items-center gap-1.5">
              {#if extracting}
                <span class="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full"></span>
                Extracting…
              {:else}
                🏷️ Extract Entities
              {/if}
            </button>
          </div>
        {:else}
          <div class="flex items-center gap-2 mt-2 mb-4" title={aiDisabledReason}>
            <button disabled class="px-3 py-1.5 bg-stone-800 text-stone-600 text-sm rounded border border-stone-700 cursor-not-allowed opacity-50">🤖 Summarize Note</button>
            <button disabled class="px-3 py-1.5 bg-stone-800 text-stone-600 text-sm rounded border border-stone-700 cursor-not-allowed opacity-50">🏷️ Extract Entities</button>
            <span class="text-stone-600 text-xs" title={aiDisabledReason}>🔒 AI disabled</span>
          </div>
        {/if}

        <!-- AI Summary Section -->
        {#if summaryResult || summaryError}
          <div class="mt-4">
            <div class="flex items-center gap-2 mb-2">
              <h2 class="text-sm font-semibold text-amber-400">🤖 AI Summary</h2>
              <span class="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">AI-generated</span>
            </div>
            {#if summaryError}
              <div class="bg-red-950/30 border border-red-900/50 rounded-lg p-4 text-red-300 text-sm">{summaryError}</div>
            {:else}
              <div class="bg-stone-900 border border-amber-900/30 rounded-lg p-5">
                <div class="prose prose-invert prose-sm text-stone-300 leading-relaxed">
                  {@html md(summaryResult)}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Extracted Entities Section -->
        {#if safe_entities.length > 0}
          <div class="mt-4">
            <div class="flex items-center gap-2 mb-2">
              <h2 class="text-sm font-semibold text-amber-400">🏷️ Extracted Entities</h2>
              <span class="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">AI-generated</span>
              <span class="text-stone-500 text-xs">{safe_entities.length} entities</span>
            </div>
            <div class="bg-stone-900 border border-amber-900/30 rounded-lg p-5">
              {#if extractionError}
                <p class="text-red-300 text-sm">{extractionError}</p>
              {:else}
                {#each Object.entries(entitiesByType()) as [type, entities]}
                  <div class="mb-3 last:mb-0">
                    <h3 class="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">{type}s</h3>
                    <div class="flex flex-wrap gap-2">
                      {#each entities as entity (entity.id)}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                          class="group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-sm cursor-default
                            {entityTypeBadge[entity.entityType] || 'bg-stone-800 text-stone-300 border-stone-700'}">
                          <span class="font-medium">{entity.name}</span>
                          {#if entity.confidence >= 0.7}
                            <span class="text-xs opacity-60">●</span>
                          {:else if entity.confidence < 0.3}
                            <span class="text-xs opacity-40">○</span>
                          {/if}
                          <!-- Tooltip -->
                          {#if entity.summary}
                            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-stone-800 border border-stone-700 rounded p-2 text-xs text-stone-300 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {entity.summary}
                              <div class="text-stone-500 mt-1">Confidence: {entity.confidence >= 0.7 ? 'high' : entity.confidence >= 0.3 ? 'medium' : 'low'}</div>
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
          <!-- Entity Merge (DM only) -->
          {#if data?.role === 'dm' && safe_entities.length >= 2}
            <div class="mt-3 flex flex-wrap gap-3">
              <button onclick={() => mergeMode = !mergeMode} class="text-xs text-stone-500 hover:text-stone-300">
                {mergeMode ? '✕ Close merge' : '🔗 Merge entities'}
              </button>
              <button
                onclick={handleAutoMerge}
                disabled={autoMerging}
                class="text-xs px-2.5 py-1 bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 rounded border border-amber-800/40 disabled:opacity-50 flex items-center gap-1.5"
              >
                {#if autoMerging}
                  <span class="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full"></span>
                  Scanning…
                {:else}
                  ✨ Auto-merge duplicates
                {/if}
              </button>
            </div>
            {#if autoMergeResult}
              <p class="text-sm mt-2 {autoMergeResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}">{autoMergeResult}</p>
            {/if}
            {#if mergeMode}
                <div class="mt-2 flex flex-col sm:flex-row gap-2 items-start">
                  <select bind:value={mergeSource} class="flex-1 px-2 py-2 bg-stone-800 border border-stone-700 rounded text-stone-200 text-sm">
                    <option value="">Primary entity...</option>
                    {#each allEntities as e}
                      <option value={e.id}>{e.name} ({e.entityType})</option>
                    {/each}
                  </select>
                  <span class="text-stone-500 text-sm self-center">← merge into</span>
                  <select bind:value={mergeTarget} class="flex-1 px-2 py-2 bg-stone-800 border border-stone-700 rounded text-stone-200 text-sm">
                    <option value="">Alias entity...</option>
                    {#each allEntities as e}
                      <option value={e.id}>{e.name} ({e.entityType})</option>
                    {/each}
                  </select>
                  <button
                    onclick={handleMergeEntities}
                    disabled={!mergeSource || !mergeTarget || merging}
                    class="px-3 py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 text-sm rounded disabled:opacity-50 min-h-[44px]"
                  >
                    {merging ? '...' : 'Merge'}
                  </button>
                </div>
                {#if mergeResult}
                  <p class="text-sm mt-2 {mergeResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}">{mergeResult}</p>
                {/if}
              {/if}
          {/if}
        {/if}
        {#if extractionError && safe_entities.length === 0}
          <div class="mt-4 bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-red-300 text-sm">{extractionError}</div>
        {/if}

        <!-- Actions -->
        <div class="flex gap-2 mt-6">
          {#if canEdit}
            <button onclick={() => editing = true} class="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm rounded">Edit</button>
          {/if}
          {#if canDelete}
            {#if !showDelete}
              <button onclick={() => showDelete = true} class="px-3 py-1.5 bg-stone-800 hover:bg-red-900/50 text-stone-300 text-sm rounded">Delete</button>
            {:else}
              <button onclick={handleDelete} disabled={saving} class="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-sm rounded disabled:opacity-50">
                {saving ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button onclick={() => showDelete = false} class="px-3 py-1.5 bg-stone-800 text-stone-300 text-sm rounded">Cancel</button>
            {/if}
          {/if}
        </div>
      </div>
    {:else}
      <div class="mt-4 space-y-4">
        {#if error}<p class="text-red-400 text-sm">{error}</p>{/if}
        <div>
          <label class="block text-stone-400 text-sm mb-1">Title</label>
          <input bind:value={editTitle} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600">
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Session Label</label>
          <input bind:value={editSessionLabel} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600">
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Body</label>
          <textarea bind:value={editBody} rows="12" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600 font-mono"></textarea>
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Visibility</label>
          <select bind:value={editVisibility} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-2">
            <option value="table">Visible to table</option>
            <option value="dm_only">DM only</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button onclick={saveEdit} disabled={saving} class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          <button onclick={() => editing = false} class="px-4 py-2 bg-stone-800 text-stone-300 text-sm rounded">Cancel</button>
        </div>
      </div>
    {/if}
  </div>
</div>
