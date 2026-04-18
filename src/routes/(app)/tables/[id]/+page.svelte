<script lang="ts">
  
  ;

  let { data } = $props();
  const safeTable = $derived(data?.table ?? null);
  const safeMembers = $derived(data?.members ?? []);
  const safeUserId = $derived(data?.userId);

  const isDm = $derived(safeMembers.some(m => m.user.id === safeUserId && m.member.role === 'dm'));
  function copyCode() {
    if (safeTable?.inviteCode) {
      navigator.clipboard.writeText(safeTable.inviteCode);
    }
  }

  async function kickMember(memberId: string, memberName: string) {
    if (!safeTable || !confirm(`Remove ${memberName} from ${safeTable.name}? Their characters will also be deleted.`)) return;
    const res = await fetch('/api/table-members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, tableId: safeTable.id }),
    });
    if (res.ok) window.location.reload();
    else {
      const d = await res.json();
      alert(d.error || 'Failed to remove member');
    }
  }

  async function dedupMembers() {
    if (!safeTable) return;
    const res = await fetch('/api/table-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: safeTable.id }),
    });
    if (res.ok) {
      const d = await res.json();
      alert(`Removed ${d.removed} duplicate member(s).`);
      window.location.reload();
    }
  }
</script>

<svelte:head>
  <title>{safeTable?.name || 'Table'} — Session Master</title>
</svelte:head>

{#if !safeTable}
  <div class="text-center py-16 text-stone-500">
    <p class="text-lg">Table not found</p>
    <a href="/tables" class="text-amber-500 hover:text-amber-400 mt-2 inline-block">Back to tables</a>
  </div>
{:else}
  <div class="max-w-4xl mx-auto">
    <a href="/tables" class="text-stone-400 hover:text-stone-200 text-sm mb-4 inline-block">← Back to tables</a>

    <div class="bg-stone-900 border border-stone-800 rounded-lg p-6 mb-8">
      <h1 class="text-2xl font-bold text-stone-100">{safeTable.name}</h1>
      {#if safeTable.description}
        <p class="text-stone-400 mt-2">{safeTable.description}</p>
      {/if}
      <div class="flex gap-4 mt-3 text-sm text-stone-500">
        <span>{safeTable.systemName}</span>
        <span>·</span>
        <span>{safeTable.edition}</span>
        {#if safeTable.timezone}
          <span>·</span>
          <span>{safeTable.timezone}</span>
        {/if}
      </div>

      <div class="mt-6 flex items-center gap-3">
        <span class="text-sm text-stone-400">Invite Code:</span>
        <code class="px-3 py-1 bg-stone-800 border border-stone-700 rounded text-amber-500 font-mono text-lg tracking-wider">
          {safeTable.inviteCode}
        </code>
        <button onclick={copyCode} class="text-stone-400 hover:text-stone-200 text-sm">
          Copy
        </button>
      </div>
    </div>

    <div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
      <h2 class="text-lg font-semibold text-stone-200 mb-4">Party Members</h2>
      {#if safeMembers.length === 0}
        <p class="text-stone-500">No members yet.</p>
      {:else}
        {#if isDm}
          <button onclick={dedupMembers} class="text-xs text-amber-500 hover:text-amber-400 mb-3">🔄 Clean up duplicates</button>
        {/if}
        <div class="space-y-3">
          {#each safeMembers as { member, user } (member.id)}
            <div class="flex items-center justify-between py-2 border-b border-stone-800 last:border-0">
              <div>
                <span class="text-stone-200">{user.name || user.email}</span>
                {#if user.id === safeUserId}
                  <span class="text-stone-600 text-xs ml-2">(you)</span>
                {/if}
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-xs font-medium {member.role === 'dm' ? 'bg-amber-900/50 text-amber-400' : 'bg-stone-800 text-stone-400'}">
                  {member.role.toUpperCase()}
                </span>
                {#if member.role !== 'dm'}
                  <button
                    onclick={() => kickMember(member.id, user.name || user.email)}
                    class="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-950/30"
                    title="Remove member"
                  >✕</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="mt-6">
      <a href="/dashboard?table={safeTable.id}" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-md transition-colors inline-block">
        Go to Dashboard
      </a>
    </div>
  </div>
{/if}
