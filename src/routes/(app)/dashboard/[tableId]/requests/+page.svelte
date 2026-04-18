<script lang="ts">
  let { data } = $props();
  
  const statusTabs = ['all', 'submitted', 'needs_changes', 'approved', 'draft', 'resolved'];

  const statusBadge: Record<string, string> = {
    draft: 'bg-stone-700 text-stone-300',
    submitted: 'bg-blue-900/50 text-blue-300',
    needs_changes: 'bg-yellow-900/50 text-yellow-300',
    approved: 'bg-green-900/50 text-green-300',
    resolved: 'bg-stone-700 text-stone-400',
  };

  const categoryIcons: Record<string, string> = {
    training: '📚', crafting: '🔨', shopping: '💰', research: '📖',
    business: '🏛️', travel: '🗺️', social: '🎭', custom: '✨',
  };

  function catIcon(cat: string) {
    const key = cat.toLowerCase().split(':')[0].trim();
    return categoryIcons[key] || '📋';
  }

  const safe_requests = $derived(data?.requests);
  const safe_status = $derived(data?.status);
</script>

<div class="p-8">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-2">
      <h1 class="text-xl font-bold text-stone-100">Requests</h1>
      <a href="/dashboard/{data?.table.id}/requests/new"
        class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded">
        + New Request
      </a>
    </div>

    <p class="text-sm text-stone-400 mb-6">
      A space for private notes and requests to your DM — between sessions or during play.
      Submit downtime activities, ask questions, or flag anything you'd like the DM to address.
    </p>

    <!-- Status filter -->
    <div class="flex gap-1 mb-6 overflow-x-auto pb-1">
      {#each statusTabs as tab}
        <a href="?status={tab}"
          class="px-3 py-1.5 text-xs rounded whitespace-nowrap
          {safe_status === tab ? 'bg-stone-800 text-stone-200' : 'text-stone-500 hover:text-stone-300'}">
          {tab === 'all' ? 'All' : tab.replace('_', ' ')}
        </a>
      {/each}
    </div>

    {#if safe_requests.length === 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-8 text-center">
        <p class="text-stone-500">No requests found.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each safe_requests as { request, user, sheet } (request.id)}
          <a href="/dashboard/{data?.table.id}/requests/{request.id}"
            class="block bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-stone-700 transition-colors">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs px-1.5 py-0.5 rounded {statusBadge[request.status] || 'bg-stone-700 text-stone-400'}">
                    {request.status.replace('_', ' ')}
                  </span>
                  <span>{catIcon(request.category)}</span>
                </div>
                <h3 class="text-stone-200 font-medium truncate">{request.title}</h3>
                <p class="text-stone-500 text-xs mt-1">
                  {sheet?.characterName || 'Unknown'} · {user.name || user.email}
                </p>
                <div class="flex gap-3 mt-1 text-xs text-stone-500">
                  {#if request.requestedTimeDays}
                    <span>⏱ {request.requestedTimeDays}d</span>
                  {/if}
                  {#if request.goldCostRequested}
                    <span>💰 {request.goldCostRequested} gp</span>
                  {/if}
                </div>
              </div>
              <span class="text-stone-600 text-sm">→</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
