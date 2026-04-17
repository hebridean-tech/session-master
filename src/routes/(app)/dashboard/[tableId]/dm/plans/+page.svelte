<script lang="ts">
  let { data } = $props();

  let plans = $state(data.plans);
  let showCreate = $state(false);
  let editingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);

  // Form state
  let title = $state('');
  let body = $state('');
  let sessionLabel = $state('');
  let tagsStr = $state('');

  // Edit form state
  let editTitle = $state('');
  let editBody = $state('');
  let editSessionLabel = $state('');
  let editTagsStr = $state('');

  let error = $state('');
  let busy = $state(false);

  function resetForm() {
    title = ''; body = ''; sessionLabel = ''; tagsStr = '';
    showCreate = false; error = '';
  }

  function startEdit(plan: any) {
    editingId = plan.id;
    editTitle = plan.title;
    editBody = plan.body;
    editSessionLabel = plan.sessionLabel || '';
    editTagsStr = (plan.tags || []).join(', ');
  }

  function cancelEdit() {
    editingId = null; error = '';
  }

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

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function parseTags(s: string) {
    return s.split(',').map(t => t.trim()).filter(Boolean);
  }

  async function handleCreate() {
    if (!title.trim()) { error = 'Title is required.'; return; }
    busy = true; error = '';
    try {
      const res = await fetch('/api/dm-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: data.table.id,
          title: title.trim(),
          body: body,
          sessionLabel: sessionLabel.trim() || null,
          tags: parseTags(tagsStr),
        }),
      });
      const json = await res.json();
      if (!res.ok) { error = json.error || 'Failed to create.'; return; }
      plans = [...plans, json.plan as any];
      resetForm();
    } catch { error = 'Network error.'; }
    finally { busy = false; }
  }

  async function handleSave() {
    if (!editingId) return;
    if (!editTitle.trim()) { error = 'Title is required.'; return; }
    busy = true; error = '';
    try {
      const res = await fetch('/api/dm-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: editingId,
          tableId: data.table.id,
          title: editTitle.trim(),
          body: editBody,
          sessionLabel: editSessionLabel.trim() || null,
          tags: parseTags(editTagsStr),
        }),
      });
      if (!res.ok) { const j = await res.json(); error = j.error || 'Failed to update.'; return; }
      plans = plans.map(p => p.id === editingId ? { ...p, title: editTitle.trim(), body: editBody, sessionLabel: editSessionLabel.trim() || null, tags: parseTags(editTagsStr), updatedAt: new Date() } : p);
      editingId = null;
    } catch { error = 'Network error.'; }
    finally { busy = false; }
  }

  async function handleDelete(id: string) {
    busy = true;
    try {
      const res = await fetch(`/api/dm-plans?planId=${id}&tableId=${data.table.id}`, { method: 'DELETE' });
      if (!res.ok) return;
      plans = plans.filter(p => p.id !== id);
      deletingId = null;
    } catch {}
    finally { busy = false; }
  }

  function preview(b: string) {
    if (!b) return '<span class="text-stone-500 italic">No content</span>';
    return md(b.length > 300 ? b.slice(0, 300) + '…' : b);
  }
</script>

<div class="p-8">
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-stone-100">📜 DM Plans</h1>
      <button onclick={() => { resetForm(); showCreate = true; }}
        class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded">
        + New Plan
      </button>
    </div>

    {#if error}
      <div class="mb-4 p-3 bg-red-900/40 border border-red-800/50 rounded text-red-300 text-sm">{error}</div>
    {/if}

    <!-- Create form -->
    {#if showCreate}
      <div class="mb-6 p-4 bg-stone-800 border border-stone-700 rounded-lg space-y-3">
        <h2 class="text-amber-400 font-semibold">New Plan</h2>
        <input bind:value={title} placeholder="Title" class="w-full px-3 py-2 bg-stone-900 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600" />
        <input bind:value={sessionLabel} placeholder="Session label (e.g. Session 12)" class="w-full px-3 py-2 bg-stone-900 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600" />
        <textarea bind:value={body} placeholder="Plan details (markdown supported)" rows="6" class="w-full px-3 py-2 bg-stone-900 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600 resize-y"></textarea>
        <input bind:value={tagsStr} placeholder="Tags (comma-separated)" class="w-full px-3 py-2 bg-stone-900 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600" />
        <div class="flex gap-2 justify-end">
          <button onclick={resetForm} class="px-3 py-1.5 text-stone-400 hover:text-stone-200 text-sm">Cancel</button>
          <button onclick={handleCreate} disabled={busy}
            class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded">
            {busy ? 'Saving…' : 'Create Plan'}
          </button>
        </div>
      </div>
    {/if}

    <!-- Plans list -->
    {#if plans.length === 0}
      <div class="text-center py-12 text-stone-500">
        <p class="text-2xl mb-2">📜</p>
        <p>No plans yet. Create one to start organizing your session prep.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each plans as plan (plan.id)}
          <div class="bg-stone-800 border border-stone-700 rounded-lg p-4">
            {#if editingId === plan.id}
              <!-- Edit mode -->
              <div class="space-y-3">
                <input bind:value={editTitle} class="w-full px-3 py-2 bg-stone-900 border border-stone-600 rounded text-stone-200 focus:outline-none focus:border-amber-600" />
                <input bind:value={editSessionLabel} placeholder="Session label" class="w-full px-3 py-2 bg-stone-900 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600" />
                <textarea bind:value={editBody} rows="8" class="w-full px-3 py-2 bg-stone-900 border border-stone-600 rounded text-stone-200 focus:outline-none focus:border-amber-600 resize-y"></textarea>
                <input bind:value={editTagsStr} placeholder="Tags (comma-separated)" class="w-full px-3 py-2 bg-stone-900 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600" />
                <div class="flex gap-2 justify-end">
                  <button onclick={cancelEdit} class="px-3 py-1.5 text-stone-400 hover:text-stone-200 text-sm">Cancel</button>
                  <button onclick={handleSave} disabled={busy}
                    class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded">
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            {:else}
              <!-- Display mode -->
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <h3 class="text-amber-400 font-semibold text-base">{plan.title}</h3>
                    {#if plan.sessionLabel}
                      <span class="px-2 py-0.5 bg-amber-900/40 text-amber-300 text-xs rounded">{plan.sessionLabel}</span>
                    {/if}
                  </div>
                  {#if plan.tags?.length}
                    <div class="flex gap-1 flex-wrap mb-2">
                      {#each plan.tags as tag}
                        <span class="px-1.5 py-0.5 bg-stone-700 text-stone-300 text-xs rounded">{tag}</span>
                      {/each}
                    </div>
                  {/if}
                  <div class="text-stone-300 text-sm leading-relaxed">{@html preview(plan.body)}</div>
                  <p class="text-stone-500 text-xs mt-2">Updated {formatDate(plan.updatedAt instanceof Date ? plan.updatedAt.toISOString() : plan.updatedAt)}</p>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button onclick={() => startEdit(plan)} class="px-2 py-1 text-stone-400 hover:text-amber-400 text-sm" title="Edit">✏️</button>
                  {#if deletingId === plan.id}
                    <button onclick={() => handleDelete(plan.id)} disabled={busy}
                      class="px-2 py-1 text-red-400 hover:text-red-300 text-sm font-medium" title="Confirm delete">
                      {busy ? '…' : 'Sure?'}
                    </button>
                  {:else}
                    <button onclick={() => { deletingId = plan.id; }}
                      class="px-2 py-1 text-stone-400 hover:text-red-400 text-sm" title="Delete">🗑️</button>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <div class="mt-8">
      <a href="/dashboard/{data.table.id}" class="text-stone-400 hover:text-stone-200 text-sm">← Back to Dashboard</a>
    </div>
  </div>
</div>
