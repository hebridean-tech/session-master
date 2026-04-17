<script lang="ts">
  import DiceRoller from '$lib/components/DiceRoller.svelte';
  import type { RollResult } from '$lib/dice';

  let { data } = $props();
  const safe_requestId = $derived(data?.requestId);
  const safe_rolls = $derived(data?.rolls);
  const safe_requests = $derived(data?.requests);
  const safe_status = $derived(data?.status);
  const safe_timeWindows = $derived(data?.timeWindows);
  const safe_requestsWithRolls = $derived(data?.requestsWithRolls);
  
  const tabs = ['submitted', 'needs_changes', 'approved', 'resolved', 'all'];

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

  let notes: Record<string, string> = $state({});
  let showRoller = $state<string | null>(null); // requestId
  let pendingRoll: {
    requestId: string;
    rollType: string; diceExpression: string; modifier: number; resultJson: RollResult; visibleToPlayers: boolean;
  } | null = $state(null);

  function getRollsForRequest(requestId: string) {
    return data.requestsWithRolls.find(r => r.requestId === requestId)?.rolls || [];
  }

  function handleDiceRoll(result: { rollType: string; diceExpression: string; modifier: number; resultJson: RollResult; visibleToPlayers: boolean }) {
    if (!showRoller) return;
    pendingRoll = { requestId: showRoller, ...result };
    setTimeout(() => {
      const form = document.getElementById('diceRollForm') as HTMLFormElement;
      if (form) form.submit();
    }, 100);
  }

</script>

<div class="p-8">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-xl font-bold text-stone-100 mb-6">DM Queue</h1>

    <div class="flex gap-1 mb-6 overflow-x-auto pb-1">
      {#each tabs as tab}
        <a href="?status={tab}"
          class="px-3 py-1.5 text-xs rounded whitespace-nowrap
          {safe_status === tab ? 'bg-stone-800 text-stone-200' : 'text-stone-500 hover:text-stone-300'}">
          {tab === 'all' ? 'All' : tab.replace('_', ' ')}
        </a>
      {/each}
    </div>

    {#if safe_requests.length === 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-8 text-center">
        <p class="text-stone-500">✨ All caught up!</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each safe_requests as { request, user, sheet } (request.id)}
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-4">
            <a href="/dashboard/{data?.table.id}/requests/{request.id}" class="block mb-3">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs px-1.5 py-0.5 rounded {statusBadge[request.status] || ''}">
                  {request.status.replace('_', ' ')}
                </span>
                <span class="text-sm">{catIcon(request.category)}</span>
              </div>
              <h3 class="text-stone-200 font-medium">{request.title}</h3>
              <p class="text-stone-500 text-xs mt-1">
                {sheet?.characterName || '?'} · {user.name || user.email}
                {#if request.requestedTimeDays} · ⏱ {request.requestedTimeDays}d{/if}
                {#if request.goldCostRequested} · 💰 {request.goldCostRequested}gp{/if}
              </p>
            </a>

            <!-- Inline dice rolls -->
            {#each getRollsForRequest(request.id) as roll}
              <div class="bg-stone-800 rounded px-3 py-2 mb-2 text-sm">
                <span class="text-amber-400 font-bold">{(roll.roll.resultJson as RollResult).total}</span>
                <span class="text-stone-500 text-xs ml-2">{roll.roll.diceExpression}</span>
                {#if !roll.roll.visibleToPlayers}
                  <span class="text-amber-600 text-xs ml-1">🔒</span>
                {/if}
              </div>
            {/each}

            {#if request.status === 'submitted' || request.status === 'needs_changes'}
              <div class="pt-3 border-t border-stone-800 space-y-2">
                <textarea
                  bind:value={notes[request.id]}
                  rows="1" placeholder="Optional note..."
                  class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-xs"></textarea>
                <div class="flex gap-2">
                  {#if request.status === 'submitted'}
                    <form method="POST" action="?/approve" class="inline">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="dmNote" value={notes[request.id] || ''} />
                      <button type="submit" class="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded">Approve</button>
                    </form>
                    <form method="POST" action="?/deny" class="inline">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="dmNote" value={notes[request.id] || ''} />
                      <button type="submit" class="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded">Deny</button>
                    </form>
                  {/if}
                  {#if request.status === 'needs_changes'}
                    <form method="POST" action="?/approve" class="inline">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="dmNote" value={notes[request.id] || ''} />
                      <button type="submit" class="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded">Approve</button>
                    </form>
                  {/if}
                  <button onclick={() => showRoller = request.id} class="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded border border-stone-700">
                    🎲 Roll
                  </button>
                </div>
              </div>
            {/if}

            {#if request.status === 'approved'}
              <div class="pt-3 border-t border-stone-800 flex gap-2">
                <form method="POST" action="?/resolve" class="inline">
                  <input type="hidden" name="requestId" value={request.id} />
                  <button type="submit" class="px-2 py-1 bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs rounded">Resolve</button>
                </form>
                <button onclick={() => showRoller = request.id} class="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded border border-stone-700">
                  🎲 Roll
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showRoller}
  <DiceRoller onRoll={handleDiceRoll} onClose={() => showRoller = null} />
{/if}

{#if pendingRoll}
  <form id="diceRollForm" method="POST" action="?/diceRoll" class="hidden">
    <input name="requestId" value={pendingRoll.requestId} />
    <input name="rollType" value={pendingRoll.rollType} />
    <input name="diceExpression" value={pendingRoll.diceExpression} />
    <input name="modifier" value={pendingRoll.modifier} />
    <input name="resultJson" value={JSON.stringify(pendingRoll.resultJson)} />
    <input name="visibleToPlayers" value={pendingRoll.visibleToPlayers ? 'true' : 'false'} />
    <input name="currentStatus" value={safe_status} />
  </form>
{/if}
