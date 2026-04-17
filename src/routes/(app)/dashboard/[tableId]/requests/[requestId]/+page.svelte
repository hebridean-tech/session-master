<script lang="ts">
  import DiceRoller from '$lib/components/DiceRoller.svelte';
  import type { RollResult } from '$lib/dice';

  let { data } = $props();
    let isDm = $derived(data?.role === 'dm');
  let isOwner = $derived(data.request.createdByUserId === data.userId);

  const statusBadge: Record<string, string> = {
    draft: 'bg-stone-700 text-stone-300',
    submitted: 'bg-blue-900/50 text-blue-300',
    needs_changes: 'bg-yellow-900/50 text-yellow-300',
    approved: 'bg-green-900/50 text-green-300',
    resolved: 'bg-stone-700 text-stone-400',
  };

  let dmNote = $state('');
  let showRoller = $state(false);
  let showRulingForm = $state<'approve' | 'deny' | null>(null);

  const materials = $derived(data.request.materialsJson as { name: string; quantity: number }[] || []);
  const hasRuling = $derived(!!data.request.dmRuling || !!data.request.outcomeSummary || data.request.approvedTimeDays != null);
  const showRulingToPlayer = $derived(data.request.status === 'resolved' || data.request.status === 'approved');

  // AI suggestion states
  let suggesting = $state(false);
  let suggestionError = $state('');
  const aiInventoryEnabled = $derived(
    isDm && data.aiSettings && data.aiSettings.permissionLevel >= 2 &&
    (data.aiSettings.enabledActionsJson as Record<string, boolean>)?.inventory_suggestions
  );
  const isResolved = $derived(data.request.status === 'resolved');

  async function handleSuggestInventory() {
    suggesting = true; suggestionError = '';
    try {
      const res = await fetch('/api/ai/suggest-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: data.request.id, tableId: data?.table.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      window.location.reload();
    } catch (e: any) { suggestionError = e.message; }
    suggesting = false;
  }

  async function reviewSuggestion(suggestionId: string, action: 'approve' | 'reject') {
    try {
      const res = await fetch('/api/ai/suggestion-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, action, tableId: data?.table.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      window.location.reload();
    } catch (e: any) { alert(e.message); }
  }

  // Dice roll form hidden fields
  let pendingRoll: {
    rollType: string; diceExpression: string; modifier: number; resultJson: RollResult; visibleToPlayers: boolean;
  } | null = $state(null);

  function handleDiceRoll(result: {
    rollType: string; diceExpression: string; modifier: number; resultJson: RollResult; visibleToPlayers: boolean;
  }) {
    pendingRoll = result;
    // Auto-submit via hidden form
    setTimeout(() => {
      const form = document.getElementById('diceRollForm') as HTMLFormElement;
      if (form) form.submit();
    }, 100);
  }

  const safe_request = $derived(data?.request);
  const safe_userName = $derived(data?.user?.name);
  const safe_characterName = $derived(data?.sheet?.characterName);
  const safe_comments = $derived(data?.comments);
  const safe_diceRolls = $derived(data?.diceRolls ?? []);
  const safe_suggestions = $derived(data?.suggestions ?? []);
  const safe_aiSettings = $derived(data?.aiSettings);
  const safe_timeAllocation = $derived(data?.timeAllocation);
  const safe_timeWindows = $derived(data?.timeWindows ?? []);
  const safe_timeWindow = $derived(safe_timeWindows.length > 0 ? safe_timeWindows[0] : null);
</script>

<div class="p-8">
  <div class="max-w-2xl mx-auto space-y-6">
    <!-- Header -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs px-1.5 py-0.5 rounded {statusBadge[safe_request.status] || ''}">
          {safe_request.status.replace('_', ' ')}
        </span>
        <a href="/dashboard/{data?.table.id}/requests" class="text-stone-500 hover:text-stone-300 text-xs">← Back</a>
      </div>
      <h1 class="text-2xl font-bold text-stone-100">{safe_request.title}</h1>
      <p class="text-stone-500 text-sm mt-1">
        {safe_characterName || 'Unknown character'} · {safe_userName} · {new Date(safe_request.createdAt).toLocaleDateString()}
      </p>
    </div>

    <!-- Request Details -->
    <div class="bg-stone-900 border border-stone-800 rounded-lg p-5 space-y-4">
      <div class="grid grid-cols-3 gap-3 text-sm">
        <div>
          <span class="text-stone-500 text-xs block">Category</span>
          <span class="text-stone-200">{safe_request.category}</span>
        </div>
        {#if safe_request.requestedTimeDays}
          <div>
            <span class="text-stone-500 text-xs block">Time Requested</span>
            <span class="text-stone-200">{safe_request.requestedTimeDays} days</span>
          </div>
        {/if}
        {#if safe_request.goldCostRequested}
          <div>
            <span class="text-stone-500 text-xs block">Gold Requested</span>
            <span class="text-stone-200">{safe_request.goldCostRequested} gp</span>
          </div>
        {/if}
      </div>

      <div>
        <h3 class="text-stone-500 text-xs mb-1">Description</h3>
        <div class="text-stone-200 text-sm whitespace-pre-wrap">{safe_request.description}</div>
      </div>

      {#if materials.length > 0}
        <div>
          <h3 class="text-stone-500 text-xs mb-2">Materials</h3>
          <div class="space-y-1">
            {#each materials as m}
              <p class="text-stone-300 text-sm">• {m.name} ×{m.quantity}</p>
            {/each}
          </div>
        </div>
      {/if}

      {#if safe_request.rulesReference}
        <div>
          <h3 class="text-stone-500 text-xs mb-1">Rules Reference</h3>
          <p class="text-stone-400 text-sm whitespace-pre-wrap">{safe_request.rulesReference}</p>
        </div>
      {/if}

      <!-- Time allocation info -->
      {#if safe_timeWindow}
        <div class="border-t border-stone-800 pt-3">
          <span class="text-stone-500 text-xs block">Downtime Window</span>
          <span class="text-stone-300 text-sm">{safe_timeWindow.label} — {safe_timeAllocation[0]?.alloc?.daysAllocated || '?'} days allocated</span>
        </div>
      {/if}
    </div>

    <!-- DM Ruling Section (visible when resolved or approved) -->
    {#if hasRuling && showRulingToPlayer}
      <div class="bg-stone-900 border border-amber-900/40 rounded-lg p-5 space-y-3">
        <h2 class="text-sm font-semibold text-amber-400">⚔ DM Ruling</h2>

        {#if safe_request.approvedTimeDays != null}
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-stone-500 text-xs block">Time Approved</span>
              <span class="text-stone-200">{safe_request.approvedTimeDays} days
                {#if safe_request.requestedTimeDays && safe_request.approvedTimeDays !== safe_request.requestedTimeDays}
                  <span class="text-stone-500">(requested {safe_request.requestedTimeDays})</span>
                {/if}
              </span>
            </div>
            {#if safe_request.goldCostApproved != null}
              <div>
                <span class="text-stone-500 text-xs block">Gold Approved</span>
                <span class="text-stone-200">{safe_request.goldCostApproved} gp
                  {#if safe_request.goldCostRequested && safe_request.goldCostApproved !== safe_request.goldCostRequested}
                    <span class="text-stone-500">(requested {safe_request.goldCostRequested})</span>
                  {/if}
                </span>
              </div>
            {/if}
          </div>
        {/if}

        {#if safe_request.outcomeSummary}
          <div>
            <span class="text-stone-500 text-xs block">Outcome</span>
            <p class="text-stone-200 text-sm whitespace-pre-wrap">{safe_request.outcomeSummary}</p>
          </div>
        {/if}

        {#if safe_request.dmRuling}
          <div>
            <span class="text-stone-500 text-xs block">Ruling Notes</span>
            <p class="text-stone-200 text-sm whitespace-pre-wrap">{safe_request.dmRuling}</p>
          </div>
        {/if}

        {#if safe_request.status === 'resolved'}
          <p class="text-stone-500 text-xs">Resolved {new Date(safe_request.resolvedAt!).toLocaleString()}</p>
        {/if}
      </div>
    {/if}

    <!-- AI Inventory Suggestions -->
    {#if isDm && isResolved}
      <div class="bg-stone-900 border border-amber-900/30 rounded-lg p-5 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-amber-400">🤖 AI Inventory Suggestions</h2>
            {#if safe_suggestions.length > 0}
              <span class="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">AI-generated</span>
            {/if}
          </div>
          {#if aiInventoryEnabled}
            <button onclick={handleSuggestInventory} disabled={suggesting}
              class="px-3 py-1.5 bg-amber-700/50 hover:bg-amber-700 text-amber-200 text-sm rounded border border-amber-800/50 disabled:opacity-50 flex items-center gap-1.5">
              {#if suggesting}
                <span class="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full"></span>
                Generating…
              {:else}
                ✨ Suggest Inventory Changes
              {/if}
            </button>
          {:else if safe_aiSettings}
            <span class="text-stone-600 text-xs" title="Need permission level 2+ and inventory_suggestions enabled">🔒 AI inventory suggestions disabled</span>
          {/if}
        </div>

        {#if suggestionError}
          <p class="text-red-300 text-sm">{suggestionError}</p>
        {/if}

        {#if safe_suggestions.length > 0}
          <div class="space-y-2">
            {#each safe_suggestions as sug (sug.id)}
              <div class="bg-stone-800 rounded-lg p-4 border border-stone-700">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-stone-200 font-medium">{sug.itemName || 'Currency Change'}</span>
                      <span class="text-xs px-1.5 py-0.5 rounded bg-stone-700 text-stone-400">{sug.changeType.replace('_', ' ')}</span>
                      {#if sug.duplicateCheckStatus === 'duplicate_found'}
                        <span class="text-xs text-yellow-500" title="Similar suggestion already exists">⚠ duplicate</span>
                      {/if}
                    </div>
                    {#if sug.quantityDelta != null}
                      <span class="text-stone-400 text-xs">Qty: {sug.quantityDelta > 0 ? '+' : ''}{sug.quantityDelta}</span>
                    {/if}
                    {#if sug.rationale}
                      <p class="text-stone-400 text-xs mt-1">{sug.rationale}</p>
                    {/if}
                  </div>
                  <div class="flex gap-1.5 flex-shrink-0">
                    {#if sug.reviewStatus === 'pending'}
                      <button onclick={() => reviewSuggestion(sug.id, 'approve')}
                        class="px-2 py-1 bg-green-800 hover:bg-green-700 text-green-200 text-xs rounded">✓ Approve</button>
                      <button onclick={() => reviewSuggestion(sug.id, 'reject')}
                        class="px-2 py-1 bg-red-800 hover:bg-red-700 text-red-200 text-xs rounded">✗ Reject</button>
                    {:else}
                      <span class="text-xs px-1.5 py-0.5 rounded {sug.reviewStatus === 'approved' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}">
                        {sug.reviewStatus}
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else if !suggesting}
          <p class="text-stone-600 text-sm">No suggestions yet. Click the button above to generate AI inventory suggestions based on this downtime action's outcome.</p>
        {/if}
      </div>
    {/if}

    <!-- Dice Rolls -->
    {#if safe_diceRolls.length > 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-stone-400 mb-3">🎲 Dice Rolls</h2>
        <div class="space-y-2">
          {#each safe_diceRolls as { roll: r, user: rollUser }}
            {#if isDm || r.visibleToPlayers}
              <div class="bg-stone-800 rounded p-3">
                <div class="flex items-center justify-between">
                  <span class="text-amber-400 font-bold text-lg">{(r.resultJson as RollResult).total}</span>
                  <div class="text-right">
                    <span class="text-stone-400 text-xs">{r.rollType}</span>
                    <span class="text-stone-600 text-xs block">{rollUser?.name} · {new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <p class="text-stone-400 text-xs mt-1">
                  {r.diceExpression} — [{(r.resultJson as RollResult).dice.join(', ')}]
                  {(r.resultJson as RollResult).modifier ? ` ${(r.resultJson as RollResult).modifier >= 0 ? '+' : ''}${(r.resultJson as RollResult).modifier}` : ''}
                  {(r.resultJson as RollResult).mode !== 'normal' ? ` (${(r.resultJson as RollResult).mode})` : ''}
                </p>
                {#if !r.visibleToPlayers}
                  <span class="text-amber-600 text-xs">🔒 DM-only</span>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- DM Actions -->
    {#if isDm && (safe_request.status === 'submitted' || safe_request.status === 'needs_changes')}
      <div class="bg-stone-900 border border-amber-900/30 rounded-lg p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-amber-400">DM Actions</h2>
          <button onclick={() => showRoller = true} class="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded border border-stone-700">
            🎲 Require Roll
          </button>
        </div>

        {#if showRulingForm === null}
          <div class="flex gap-2">
            {#if safe_request.status === 'submitted'}
              <button onclick={() => showRulingForm = 'approve'} class="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-sm rounded">Approve</button>
              <button onclick={() => showRulingForm = 'deny'} class="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded">Deny</button>
            {/if}
            <button onclick={() => showRulingForm = 'deny'} class="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white text-sm rounded">Request Changes</button>
          </div>
        {:else if showRulingForm === 'approve'}
          <form method="POST" action="?/approve" class="space-y-3">
            <div>
              <label class="text-stone-500 text-xs block mb-1">Outcome Summary</label>
              <textarea name="outcomeSummary" rows="2" placeholder="Describe the outcome..." class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-stone-500 text-xs block mb-1">Approved Time (days)</label>
                <input type="number" name="approvedTimeDays" min="0"
                  value={safe_request.requestedTimeDays || ''}
                  placeholder={safe_request.requestedTimeDays ? `${safe_request.requestedTimeDays} (requested)` : ''}
                  class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label class="text-stone-500 text-xs block mb-1">Approved Gold Cost</label>
                <input type="number" name="goldCostApproved" min="0"
                  value={safe_request.goldCostRequested || ''}
                  placeholder={safe_request.goldCostRequested ? `${safe_request.goldCostRequested} (requested)` : ''}
                  class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            {#if safe_timeWindows.length > 0}
              <div>
                <label class="text-stone-500 text-xs block mb-1">Downtime Window</label>
                <select name="timeWindowId" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {#each safe_timeWindows as w}
                    <option value={w.id}>{w.label}{w.inWorldDaysAvailable ? ` (${w.inWorldDaysAvailable}d available)` : ''}</option>
                  {/each}
                </select>
              </div>
            {/if}
            <div>
              <label class="text-stone-500 text-xs block mb-1">Ruling Notes</label>
              <textarea name="dmRuling" rows="2" placeholder="Optional DM notes..." class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm"></textarea>
            </div>
            <div>
              <label class="text-stone-500 text-xs block mb-1">Complications (optional)</label>
              <textarea name="consequences" rows="1" placeholder="Any additional consequences..." class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm"></textarea>
            </div>
            <div>
              <label class="text-stone-500 text-xs block mb-1">XP Awarded (optional)</label>
              <input type="number" name="xpAwarded" min="0" placeholder="0" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
            </div>
            <div class="flex gap-2">
              <button type="submit" class="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-sm rounded">Confirm Approve</button>
              <button type="button" onclick={() => showRulingForm = null} class="px-3 py-1.5 text-stone-400 hover:text-stone-200 text-sm">Cancel</button>
            </div>
          </form>
        {:else if showRulingForm === 'deny'}
          <form method="POST" action="?/deny" class="space-y-3">
            <div>
              <label class="text-stone-500 text-xs block mb-1">Reason for denial / changes needed</label>
              <textarea name="dmRuling" rows="2" placeholder="Explain what needs to change..." class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm"></textarea>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded">Confirm Deny</button>
              <button type="button" onclick={() => showRulingForm = null} class="px-3 py-1.5 text-stone-400 hover:text-stone-200 text-sm">Cancel</button>
            </div>
          </form>
        {/if}
      </div>
    {/if}

    {#if isDm && safe_request.status === 'approved'}
      <div class="flex gap-2 items-center">
        <form method="POST" action="?/resolve">
          <button type="submit" class="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm rounded">
            Mark Resolved
          </button>
        </form>
        <button onclick={() => showRoller = true} class="px-2 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded border border-stone-700">
          🎲 Roll
        </button>
      </div>
    {/if}

    <!-- Player Actions -->
    {#if isOwner && safe_request.status === 'draft'}
      <div class="flex gap-2">
        <form method="POST" action="?/submit">
          <button type="submit" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded">Submit</button>
        </form>
        <a href="/dashboard/{data?.table.id}/requests/new" class="px-3 py-1.5 text-stone-400 hover:text-stone-200 text-sm border border-stone-700 rounded">
          Edit
        </a>
      </div>
    {/if}

    <!-- Comments -->
    <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
      <h2 class="text-sm font-semibold text-stone-400 mb-4">Comments ({safe_comments.length})</h2>

      <div class="space-y-3 mb-4">
        {#each safe_comments as c}
          <div class="border-b border-stone-800 pb-3 last:border-0">
            <div class="flex items-center gap-2 text-xs mb-1">
              <span class="text-stone-300 font-medium">{c.user?.name}</span>
              {#if c.comment.isDmOnly}
                <span title="DM-only" class="text-amber-500">🔒</span>
              {/if}
              <span class="text-stone-600">{new Date(c.comment.createdAt).toLocaleString()}</span>
            </div>
            <p class="text-stone-200 text-sm whitespace-pre-wrap">{c.comment.body}</p>
          </div>
        {/each}
        {#if safe_comments.length === 0}
          <p class="text-stone-600 text-sm">No comments yet.</p>
        {/if}
      </div>

      <form method="POST" action="?/comment" class="space-y-2">
        <textarea name="body" rows="2" placeholder="Add a comment..."
          class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-600"></textarea>
        <div class="flex items-center justify-between">
          {#if isDm}
            <label class="flex items-center gap-1.5 text-xs text-stone-400">
              <input type="checkbox" name="isDmOnly" class="rounded" /> DM-only
            </label>
          {:else}
            <span></span>
          {/if}
          <button type="submit" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded">Comment</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- Dice Roller Modal -->
{#if showRoller}
  <DiceRoller onRoll={handleDiceRoll} onClose={() => showRoller = false} />
{/if}

<!-- Hidden form for dice roll submission -->
{#if pendingRoll}
  <form id="diceRollForm" method="POST" action="?/diceRoll" class="hidden">
    <input name="rollType" value={pendingRoll.rollType} />
    <input name="diceExpression" value={pendingRoll.diceExpression} />
    <input name="modifier" value={pendingRoll.modifier} />
    <input name="resultJson" value={JSON.stringify(pendingRoll.resultJson)} />
    <input name="visibleToPlayers" value={pendingRoll.visibleToPlayers ? 'true' : 'false'} />
  </form>
{/if}
