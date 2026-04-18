<script lang="ts">
  let { data } = $props();
  const isDm = $derived(data?.role === 'dm');
  const safe_windows = $derived(data?.windows ?? []);
  let editingWindowId = $state<string | null>(null);
</script>

<div class="p-8">
  <div class="max-w-2xl mx-auto space-y-6">
    <h1 class="text-xl font-bold text-stone-100">Settings</h1>

    <!-- Invite Code / Share Link -->
    <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
      <h2 class="text-sm font-semibold text-amber-400 mb-3">🔗 Invite Code</h2>
      <p class="text-stone-400 text-xs mb-3">Share this code with players so they can join your table.</p>
      <div class="flex items-center gap-2">
        <code class="flex-1 bg-stone-800 border border-stone-700 text-amber-400 font-mono text-lg px-3 py-2 rounded select-all">{data?.table?.inviteCode}</code>
        <button
          onclick={() => {
            const code = data?.table?.inviteCode;
            if (code) navigator.clipboard?.writeText(code);
          }}
          class="px-3 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm rounded transition-colors"
          title="Copy invite code"
        >📋 Copy</button>
      </div>
    </div>

    <!-- Downtime Windows -->
    {#if isDm}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-amber-400 mb-4">⏱ Downtime Windows</h2>

        {#if safe_windows.length === 0}
          <p class="text-stone-500 text-sm mb-4">No downtime windows yet. Create one to track in-world time.</p>
        {:else}
          <div class="space-y-3 mb-6">
            {#each safe_windows as win (win.id)}
              <div class="bg-stone-800 border border-stone-700 rounded-lg p-4">
                {#if editingWindowId === win.id}
                  <form method="POST" action="?/updateWindow" class="space-y-2">
                    <input type="hidden" name="windowId" value={win.id} />
                    <input name="label" value={win.label} class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
                    <div class="grid grid-cols-3 gap-2">
                      <div>
                        <label class="text-stone-500 text-xs block mb-1">Start</label>
                        <input type="date" name="startAt" value={win.startAt ? new Date(win.startAt).toISOString().slice(0, 10) : ''} class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label class="text-stone-500 text-xs block mb-1">End</label>
                        <input type="date" name="endAt" value={win.endAt ? new Date(win.endAt).toISOString().slice(0, 10) : ''} class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label class="text-stone-500 text-xs block mb-1">Days</label>
                        <input type="number" name="days" value={win.inWorldDaysAvailable || ''} class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
                      </div>
                    </div>
                    <textarea name="notes" rows="1" placeholder="Notes..." class="w-full bg-stone-900 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm">{win.notes || ''}</textarea>
                    <div class="flex gap-2">
                      <button type="submit" class="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded">Save</button>
                      <button type="button" onclick={() => editingWindowId = null} class="px-2 py-1 text-stone-400 hover:text-stone-200 text-xs">Cancel</button>
                    </div>
                  </form>
                {:else}
                  <div class="flex justify-between items-start">
                    <div>
                      <h3 class="text-stone-200 font-medium">{win.label}</h3>
                      {#if win.inWorldDaysAvailable}
                        <p class="text-amber-400 text-sm">{win.inWorldDaysAvailable} days available</p>
                      {/if}
                      {#if win.startAt || win.endAt}
                        <p class="text-stone-500 text-xs mt-1">
                          {win.startAt ? new Date(win.startAt).toLocaleDateString() : '?'} → {win.endAt ? new Date(win.endAt).toLocaleDateString() : '?'}
                        </p>
                      {/if}
                      {#if win.notes}
                        <p class="text-stone-500 text-xs mt-1">{win.notes}</p>
                      {/if}
                    </div>
                    <div class="flex gap-1">
                      <button onclick={() => editingWindowId = win.id} class="px-2 py-1 text-stone-400 hover:text-stone-200 text-xs rounded hover:bg-stone-700">Edit</button>
                      <form method="POST" action="?/deleteWindow" class="inline">
                        <input type="hidden" name="windowId" value={win.id} />
                        <button type="submit" class="px-2 py-1 text-red-400 hover:text-red-300 text-xs rounded hover:bg-stone-700">Delete</button>
                      </form>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Create new window -->
        <form method="POST" action="?/createWindow" class="space-y-2 border-t border-stone-700 pt-4">
          <h3 class="text-stone-300 text-sm font-medium">New Window</h3>
          <input name="label" placeholder="e.g. Session 14 → Session 15" required
            class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="text-stone-500 text-xs block mb-1">Start (optional)</label>
              <input type="date" name="startAt" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label class="text-stone-500 text-xs block mb-1">End (optional)</label>
              <input type="date" name="endAt" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label class="text-stone-500 text-xs block mb-1">Days Available</label>
              <input type="number" name="days" min="0" placeholder="0" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-2 py-1 text-sm" />
            </div>
          </div>
          <textarea name="notes" rows="1" placeholder="Notes (optional)" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm"></textarea>
          <button type="submit" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded">Create Window</button>
        </form>
      </div>
    {:else}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <p class="text-stone-500 text-sm">Settings are available to the DM only.</p>
      </div>
    {/if}
  </div>
</div>
