<script lang="ts">
  let { data } = $props();
  
  let filterAuthor = $state('');
  let filterLabel = $state('');
  let filterSource = $state('');

  $effect(() => { filterAuthor; filterLabel; filterSource; }); // reactivity hint

  let filtered = $derived(data.notes.filter(n => {
    if (filterAuthor && n.user.id !== filterAuthor) return false;
    if (filterLabel && n.note.sessionLabel !== filterLabel) return false;
    if (filterSource && n.note.sourceType !== filterSource) return false;
    return true;
  }));

  function preview(body: string) {
    return body.length > 200 ? body.slice(0, 200) + '…' : body;
  }

  const sourceBadge: Record<string, string> = {
    upload: 'bg-blue-900/50 text-blue-300',
    in_app: 'bg-green-900/50 text-green-300',
  };

  let bulkExtracting = $state(false);
  let bulkProgress = $state({ current: 0, total: 0 });
  let bulkError = $state('');

  async function handleBulkExtract() {
    const notes = filtered.filter(n => n.note.sourceType === 'in_app' || n.note.body);
    if (notes.length === 0) return;
    bulkExtracting = true;
    bulkError = '';
    bulkProgress = { current: 0, total: notes.length };
    for (let i = 0; i < notes.length; i++) {
      bulkProgress.current = i + 1;
      try {
        await fetch('/api/ai/extract-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteId: notes[i].note.id, tableId: data?.table.id }),
        });
      } catch { /* continue on failure */ }
    }
    bulkExtracting = false;
    window.location.reload();
  }

  const safe_notes = $derived(data?.notes);
  const safe_members = $derived(data?.members);
  const safe_labels = $derived(data?.labels);
  const safe_aiSettings = $derived(data?.aiSettings);
</script>

<div class="p-4 sm:p-8">
  <div class="max-w-2xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <h1 class="text-xl font-bold text-stone-100">Session Notes</h1>
      <div class="flex gap-2">
        {#if data?.role === 'dm' && safe_aiSettings && safe_aiSettings.permissionLevel >= 1}
          {#if !bulkExtracting}
            <button onclick={handleBulkExtract}
              class="px-3 py-1.5 bg-amber-700/50 hover:bg-amber-700 text-amber-200 text-sm rounded border border-amber-800/50 flex items-center gap-1.5">
              🏷️ Extract Entities from All
            </button>
          {:else}
            <button disabled
              class="px-3 py-1.5 bg-amber-700/50 text-amber-200 text-sm rounded border border-amber-800/50 flex items-center gap-1.5 opacity-75">
              <span class="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full"></span>
              Processing {bulkProgress.current} of {bulkProgress.total}…
            </button>
          {/if}
        {/if}
        <a href="/dashboard/{data?.table.id}/notes/new"
          class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded">
          + Add Note
        </a>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6">
      <select bind:value={filterAuthor} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-3 min-h-[44px]">
        <option value="">All authors</option>
        {#each safe_members as { user } (user.id)}
          <option value={user.id}>{user.name || user.email}</option>
        {/each}
      </select>
      <select bind:value={filterLabel} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-3 min-h-[44px]">
        <option value="">All sessions</option>
        {#each safe_labels as label}
          <option value={label}>{label}</option>
        {/each}
      </select>
      <select bind:value={filterSource} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-3 min-h-[44px]">
        <option value="">All types</option>
        <option value="upload">Uploaded</option>
        <option value="in_app">Written in-app</option>
      </select>
    </div>

    {#if filtered.length === 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-8 text-center">
        <p class="text-stone-500">{safe_notes.length === 0 ? 'No notes yet.' : 'No notes match filters.'}</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each filtered as { note, user } (note.id)}
          <a href="/dashboard/{data?.table.id}/notes/{note.id}"
            class="block bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-stone-700 transition-colors">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs px-1.5 py-0.5 rounded {sourceBadge[note.sourceType] || 'bg-stone-700 text-stone-400'}">
                    {note.sourceType === 'upload' ? 'Uploaded' : 'Written in-app'}
                  </span>
                  {#if note.sessionLabel}
                    <span class="text-xs text-stone-500">Session: {note.sessionLabel}</span>
                  {/if}
                  {#if note.visibility === 'dm_only'}
                    <span class="text-xs px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">DM Only</span>
                  {/if}
                </div>
                <h3 class="text-stone-200 font-medium truncate">{note.title}</h3>
                <p class="text-stone-500 text-sm mt-1 line-clamp-2">{preview(note.body)}</p>
                <p class="text-stone-600 text-xs mt-2">{user.name || user.email} · {new Date(note.createdAt).toLocaleDateString()}</p>
              </div>
              <span class="text-stone-600 text-sm">→</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
