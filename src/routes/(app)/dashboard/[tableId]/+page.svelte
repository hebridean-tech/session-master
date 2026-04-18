<script lang="ts">
  let { data } = $props();
  const isDm = $derived(data?.role === 'dm');
  const tableName = $derived(data?.table?.name ?? 'Table');
  const partyLevel = $derived(data?.table?.currentLevel ?? 1);
  const safe_members = $derived(data?.members ?? []);
  const safe_pendingCount = $derived(data?.pendingCount ?? 0);
  const safe_activeWindow = $derived(data?.activeWindow ?? null);
  const safe_remainingDays = $derived(data?.remainingDays ?? 0);
  const safe_consumingRequests = $derived(data?.consumingRequests ?? []);
  const safe_recentActivity = $derived(data?.recentActivity ?? []);
  const safe_characters = $derived(data?.characters ?? []);
  let editingLevel = $state(false);
  let levelInput = $state(partyLevel);

  async function saveLevel() {
    try {
      const resp = await fetch('/api/table-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: data?.table?.id, level: levelInput }),
      });
      if (resp.ok) window.location.reload();
    } catch {}
  }
</script>

<div class="p-4 sm:p-8">
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold text-stone-100 mb-2">{tableName}</h1>
    <p class="text-stone-500 text-sm mb-8">
      {isDm ? '⚔️ Dungeon Master' : '🗡️ Player'} · {safe_members.length} members
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h3 class="text-sm font-medium text-stone-400">{isDm ? 'Pending Review' : 'Active Requests'}</h3>
        <p class="text-3xl font-bold text-stone-100 mt-1">{safe_pendingCount}</p>
      </div>

      <div class="bg-stone-900 border border-amber-900/30 rounded-lg p-5">
        <h3 class="text-sm font-medium text-amber-400">⚔️ Party Level</h3>
        {#if editingLevel && isDm}
          <div class="flex items-center gap-2 mt-2">
            <input type="number" bind:value={levelInput} min="1" max="20" class="w-16 bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-lg font-bold" />
            <button onclick={saveLevel} class="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded">✓</button>
            <button onclick={() => { editingLevel = false; levelInput = partyLevel; }} class="px-2 py-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded">✕</button>
          </div>
        {:else}
          <p class="text-3xl font-bold text-stone-100 mt-1">{partyLevel}</p>
          {#if isDm}
            <button onclick={() => editingLevel = true} class="text-amber-500 text-xs hover:text-amber-400 mt-1">Edit →</button>
          {/if}
        {/if}
      </div>

      {#if safe_activeWindow}
        <div class="bg-stone-900 border border-amber-900/30 rounded-lg p-5">
          <h3 class="text-sm font-medium text-amber-400">⏱ {safe_activeWindow.label}</h3>
          <p class="text-3xl font-bold text-stone-100 mt-1">{safe_remainingDays} <span class="text-sm text-stone-400">days left</span></p>
          {#if safe_consumingRequests.length > 0}
            <p class="text-stone-500 text-xs mt-2">{safe_consumingRequests.length} request{safe_consumingRequests.length !== 1 ? 's' : ''} using time</p>
          {/if}
        </div>
      {:else}
        <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
          <h3 class="text-sm font-medium text-stone-400">Downtime Window</h3>
          <p class="text-stone-500 mt-3 text-sm">No active window</p>
          {#if isDm}
            <a href="/dashboard/{data?.table?.id}/settings" class="text-amber-400 text-xs hover:text-amber-300 mt-1 block">Create one →</a>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Party Characters -->
    {#if safe_characters.length > 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-stone-200">Party</h2>
          <a href="/dashboard/{data?.table?.id}/party" class="text-amber-400 text-xs hover:text-amber-300">Manage →</a>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {#each safe_characters as { sheet, user } (sheet.id)}
            <a href="/dashboard/{data?.table?.id}/party/characters/{sheet.id}" class="bg-stone-800 border border-stone-700 rounded-lg p-3 hover:border-amber-800/50 transition-colors">
              <p class="text-stone-200 font-medium text-sm truncate">{sheet.characterName}</p>
              <p class="text-stone-500 text-xs">{sheet.characterClass}{sheet.level ? ` ${sheet.level}` : ''}</p>
              <p class="text-stone-600 text-xs mt-1">{sheet.species || sheet.ancestryOrSpecies || ''}</p>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Consuming requests -->
    {#if isDm && safe_consumingRequests.length > 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5 mb-8">
        <h2 class="text-sm font-semibold text-stone-300 mb-3">Time Usage</h2>
        <div class="space-y-2">
          {#each safe_consumingRequests as { request, user } (request.id)}
            <a href="/dashboard/{data?.table?.id}/requests/{request.id}" class="flex justify-between items-center py-1.5 border-b border-stone-800 last:border-0">
              <span class="text-stone-300 text-sm">{request.title}</span>
              <span class="text-stone-500 text-xs">{request.approvedTimeDays}d · {user.name || user.email}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <div class="bg-stone-900 border border-stone-800 rounded-lg p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-stone-200">Recent Activity</h2>
        <a href="/dashboard/{data?.table?.id}/log" class="text-amber-400 text-xs hover:text-amber-300">View full log →</a>
      </div>
      {#if safe_recentActivity && safe_recentActivity.length > 0}
        <div class="space-y-2">
          {#each safe_recentActivity.slice(0, 10) as { log, user } (log.id)}
            <div class="flex items-start gap-3 py-2 border-b border-stone-800 last:border-0">
              <span class="text-sm mt-0.5">{log.eventType === 'request_created' ? '📋' : log.eventType === 'status_changed' ? '🔄' : log.eventType === 'comment_added' ? '💬' : log.eventType === 'dice_rolled' ? '🎲' : log.eventType === 'note_uploaded' ? '📝' : '📌'}</span>
              <div class="flex-1 min-w-0">
                <p class="text-stone-300 text-sm truncate">{log.summary}</p>
                <p class="text-stone-600 text-xs">{user?.name || user?.email || 'System'}</p>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-stone-500 text-sm">No activity yet.</p>
      {/if}
    </div>

    <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
      <h2 class="text-lg font-semibold text-stone-200 mb-4">Party Members</h2>
      {#if safe_members.length === 0}
        <p class="text-stone-500">No members yet.</p>
      {:else}
        <div class="space-y-3">
          {#each safe_members as { member, user } (member.id)}
            <div class="flex items-center justify-between py-3 border-b border-stone-800 last:border-0">
              <div class="flex-1">
                <span class="text-stone-200 font-medium">{user.name || user.email}</span>
                {#if user.id === data?.userId}
                  <span class="text-stone-600 text-xs ml-2">(you)</span>
                {/if}
              </div>
              <span class="px-2 py-0.5 rounded text-xs font-medium {member.role === 'dm'
                ? 'bg-amber-900/50 text-amber-400'
                : 'bg-stone-800 text-stone-400'}">
                {member.role.toUpperCase()}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
