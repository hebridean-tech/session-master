<script lang="ts">
  import { goto } from '$app/navigation';

  let { data } = $props();
  
  let mode = $state<'upload' | 'write'>('write');
  let title = $state('');
  let sessionLabel = $state('');
  let body = $state('');
  let visibility = $state('table');
  let uploading = $state(false);
  let error = $state('');
  let file = $state<File | null>(null);

    async function handleUpload() {
    if (!file) { error = 'Select a file first.'; return; }
    if (!file.name) { error = 'Invalid file.'; return; }

    uploading = true;
    error = '';
    try {
      const tableId = new URL(window.location.href).pathname.split('/')[2];
      const storagePath = `uploads/notes/${tableId}/${Date.now()}-${file.name}`;

      const resp = await fetch('/api/notes/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          title: title || file.name,
          storagePath,
          originalFilename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });

      if (!resp.ok) { const e = await resp.json(); error = e.error || 'Upload failed'; return; }
      const result = await resp.json();
      window.location.href = `/dashboard/${tableId}/notes/${result.noteId}`;
    } catch (e: any) {
      error = e.message || 'Upload failed';
    } finally {
      uploading = false;
    }
  }

  async function handleWrite() {
    if (!title.trim()) { error = 'Title is required.'; return; }
    if (!body.trim()) { error = 'Body is required.'; return; }

    uploading = true;
    error = '';
    try {
      const formData = new FormData();
      formData.append('action', 'write');
      formData.append('title', title.trim());
      formData.append('body', body.trim());
      formData.append('sessionLabel', sessionLabel.trim());
      formData.append('visibility', visibility);

      const resp = await fetch(window.location.href, {
        method: 'POST',
        body: formData,
      });
      if (resp.ok) {
        const tableId = new URL(window.location.href).pathname.split('/')[2];
        window.location.href = `/dashboard/${tableId}/notes`;
      } else {
        const data = await resp.json();
        error = data.error || 'Save failed';
      }
    } catch (e: any) {
      error = e.message || 'Save failed';
    } finally {
      uploading = false;
    }
  }

  const safe_labels = $derived(data?.labels);
</script>

<div class="p-8">
  <div class="max-w-xl mx-auto">
    <a href="/dashboard/{data?.table.id}/notes" class="text-stone-500 text-sm hover:text-stone-300">← Back to notes</a>
    <h1 class="text-xl font-bold text-stone-100 mt-2 mb-6">Add Note</h1>

    <!-- Mode selector -->
    <div class="grid grid-cols-2 gap-3 mb-6">
      <button
        onclick={() => mode = 'write'}
        class="p-4 rounded-lg border text-left transition-colors {mode === 'write'
          ? 'bg-stone-800 border-amber-600 text-stone-200'
          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'}">
        <p class="font-medium">✏️ Write in-app</p>
        <p class="text-xs mt-1 opacity-70">Title, body, markdown supported</p>
      </button>
      <button
        onclick={() => mode = 'upload'}
        class="p-4 rounded-lg border text-left transition-colors {mode === 'upload'
          ? 'bg-stone-800 border-amber-600 text-stone-200'
          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'}">
        <p class="font-medium">📎 Upload a file</p>
        <p class="text-xs mt-1 opacity-70">.txt, .md, .pdf, .docx</p>
      </button>
    </div>

    {#if error}
      <p class="text-red-400 text-sm mb-4">{error}</p>
    {/if}

    {#if mode === 'write'}
      <div class="space-y-4">
        <div>
          <label class="block text-stone-400 text-sm mb-1">Title</label>
          <input bind:value={title} placeholder="Session 12 recap"
            class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600">
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Session Label</label>
          <input bind:value={sessionLabel} placeholder="Session 12" list="labels"
            class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600">
          <datalist id="labels">
            {#each safe_labels as label}
              <option value={label}></option>
            {/each}
          </datalist>
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Body</label>
          <textarea bind:value={body} rows="10" placeholder="Write your note…"
            class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600 font-mono"></textarea>
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Visibility</label>
          <select bind:value={visibility} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-2">
            <option value="table">Visible to table</option>
            <option value="dm_only">DM only</option>
          </select>
        </div>
        <button onclick={handleWrite} disabled={uploading}
          class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded disabled:opacity-50">
          {uploading ? 'Saving…' : 'Save Note'}
        </button>
      </div>
    {:else}
      <div class="space-y-4">
        <div>
          <label class="block text-stone-400 text-sm mb-1">Note Title (optional)</label>
          <input bind:value={title} placeholder="Defaults to filename"
            class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600">
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">File</label>
          <input type="file" accept=".txt,.md,.pdf,.docx" onchange={(e: Event) => { const t = e.target as HTMLInputElement; file = t.files?.[0] || null; }}
            class="block w-full text-sm text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-stone-800 file:text-stone-300 hover:file:bg-stone-700">
          {#if file}
            <p class="text-stone-500 text-xs mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
          {/if}
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Visibility</label>
          <select bind:value={visibility} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-2">
            <option value="table">Visible to table</option>
            <option value="dm_only">DM only</option>
          </select>
        </div>
        <button onclick={handleUpload} disabled={uploading || !file}
          class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded disabled:opacity-50">
          {uploading ? 'Uploading…' : 'Upload & Save'}
        </button>
      </div>
    {/if}
  </div>
</div>
