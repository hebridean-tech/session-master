<script lang="ts">
  import { page } from '$app/stores';

  let { data } = $props();
  const tableId = $derived($page.params.tableId);
  const statusColors: Record<string, string> = {
    completed: 'text-green-400 bg-green-900/40',
    failed: 'text-red-400 bg-red-900/40',
    running: 'text-amber-400 bg-amber-900/40',
    pending: 'text-stone-400 bg-stone-800',
  };
</script>

<div class="p-8">
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-stone-100">AI Job History</h1>
      <a href={`/dashboard/${tableId}/dm/ai-settings`} class="text-amber-500 hover:text-amber-400 text-sm">← Back to AI Settings</a>
    </div>

    {#if data.jobs.length === 0}
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-8 text-center">
        <p class="text-stone-500">No AI jobs have been run yet.</p>
        <p class="text-stone-600 text-sm mt-1">Jobs will appear here when AI features are used.</p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each data.jobs as { job, user } (job.id)}
          <div class="bg-stone-900 border border-stone-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-stone-200 text-sm font-medium">{job.jobType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                <span class="px-2 py-0.5 rounded text-xs {statusColors[job.status] || 'text-stone-400 bg-stone-800'}">{job.status}</span>
              </div>
              <span class="text-stone-500 text-xs">{new Date(job.createdAt).toLocaleString()}</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-stone-500">
              <span>Trigger: {job.triggerType}</span>
              <span>By: {user?.name || 'Unknown'}</span>
              {#if job.completedAt}
                <span>Completed: {new Date(job.completedAt).toLocaleString()}</span>
              {/if}
            </div>
            {#if job.outputText}
              <div class="mt-2 text-stone-400 text-sm border-t border-stone-800 pt-2 line-clamp-3 whitespace-pre-wrap">{job.outputText}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
