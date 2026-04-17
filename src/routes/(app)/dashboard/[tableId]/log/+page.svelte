<script lang="ts">
  let { data } = $props();
  const safe_entries = $derived(data?.entries ?? []);
  const safe_total = $derived(data?.total ?? 0);
  let expanded = $state<string | null>(null);

  const totalPages = Math.ceil(safe_total / 25);

  const eventTypes = ['request_created', 'status_changed', 'comment_added', 'dice_rolled', 'request_resolved', 'time_allocated', 'note_uploaded', 'character_updated', 'member_joined'];

  const eventIcons: Record<string, string> = {
    request_created: '📋', status_changed: '🔄', comment_added: '💬', dice_rolled: '🎲',
    request_resolved: '✅', time_allocated: '⏱', note_uploaded: '📝', character_updated: '👤',
    member_joined: '🧙',
  };

  function relativeTime(d: Date) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
    return new Date(d).toLocaleDateString();
  }

  function fmt(d: Date) { return new Date(d).toLocaleString(); }

  let filterActor = $state('');
  let filterEvent = $state('');
  let filterFrom = $state('');
  let filterTo = $state('');

  function applyFilters() {
    const params = new URLSearchParams();
    if (filterActor) params.set('actor', filterActor);
    if (filterEvent) params.set('event_type', filterEvent);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    return `/dashboard/${data?.table.id}/log?${params.toString()}`;
  }

  function clearFilters() {
    filterActor = ''; filterEvent = ''; filterFrom = ''; filterTo = '';
    return `/dashboard/${data?.table.id}/log`;
  }


  const safe_page = $derived(data?.page);
  const safe_actorUserId = $derived(data?.actorUserId);
  const safe_eventType = $derived(data?.eventType);
  const safe_dateFrom = $derived(data?.dateFrom);
  const safe_dateTo = $derived(data?.dateTo);
  const safe_members = $derived(data?.members);
</script>

<div class="p-8">
  <div class="max-w-3xl mx-auto">
    <h1 class="text-xl font-bold text-stone-100 mb-6">Activity Log</h1>

    <!-- Filters -->
    <div class="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-6">
      <div class="grid grid-cols-2 gap-3">
        <select bind:value={filterActor} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-2">
          <option value="">All players</option>
          {#each safe_members as { member, user } (member.id)}
            <option value={user.id}>{user.name || user.email}</option>
          {/each}
        </select>
        <select bind:value={filterEvent} class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-2">
          <option value="">All event types</option>
          {#each eventTypes as et}
            <option value={et}>{et.replace(/_/g, ' ')}</option>
          {/each}
        </select>
        <input type="date" bind:value={filterFrom} placeholder="From" class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-2">
        <input type="date" bind:value={filterTo} placeholder="To" class="bg-stone-800 border border-stone-700 text-stone-300 text-sm rounded px-3 py-2">
      </div>
      <div class="flex gap-2 mt-3">
        <a href={applyFilters()} class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded">Apply</a>
        <a href={clearFilters()} class="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm rounded">Clear</a>
      </div>
    </div>

    {#if safe_entries.length === 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-8 text-center">
        <p class="text-stone-500">No activity recorded.</p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each safe_entries as { log, user } (log.id)}
          <button
            onclick={() => expanded = expanded === log.id ? null : log.id}
            class="w-full text-left bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-stone-700 transition-colors"
          >
            <div class="flex items-start gap-3">
              <span class="text-lg mt-0.5">{eventIcons[log.eventType] || '📌'}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">{log.eventType.replace(/_/g, ' ')}</span>
                  {#if log.objectType}
                    <span class="text-xs text-stone-600">{log.objectType}</span>
                  {/if}
                </div>
                <p class="text-stone-200 text-sm">{log.summary}</p>
                <p class="text-stone-500 text-xs mt-1">
                  {user?.name || user?.email || 'System'} · {relativeTime(log.createdAt)}
                </p>
              </div>
            </div>
            {#if expanded === log.id && log.metadataJson}
              <div class="mt-3 ml-8 p-3 bg-stone-950 rounded border border-stone-800">
                <p class="text-stone-500 text-xs mb-1">Metadata</p>
                <pre class="text-stone-400 text-xs whitespace-pre-wrap">{JSON.stringify(log.metadataJson, null, 2)}</pre>
                <p class="text-stone-600 text-xs mt-2">{fmt(log.createdAt)}</p>
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex justify-center gap-2 mt-6">
        {#if safe_page > 1}
          <a href="?page={safe_page - 1}" class="px-3 py-1.5 bg-stone-800 text-stone-300 text-sm rounded hover:bg-stone-700">← Prev</a>
        {/if}
        <span class="text-stone-500 text-sm px-3 py-1.5">Page {safe_page} of {totalPages}</span>
        {#if safe_page < totalPages}
          <a href="?page={safe_page + 1}" class="px-3 py-1.5 bg-stone-800 text-stone-300 text-sm rounded hover:bg-stone-700">Next →</a>
        {/if}
      </div>
    {/if}
  </div>
</div>
