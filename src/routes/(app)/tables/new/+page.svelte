<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageServerLoad } from './$types';

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
  ];

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const resp = await fetch('?/create', { method: 'POST', body: data, redirect: 'manual' });
    if (resp.status === 303 || resp.ok) {
      const location = resp.headers.get('location') || '/dashboard';
      goto(location);
    } else {
      alert('Failed to create table');
    }
  }
</script>

<svelte:head>
  <title>Create Table — Session Master</title>
</svelte:head>

<div class="max-w-lg mx-auto">
  <h1 class="text-2xl font-bold text-stone-100 mb-8">Create a Table</h1>

  <form onsubmit={handleSubmit} class="space-y-5">
    <div>
      <label for="name" class="block text-sm font-medium text-stone-300 mb-1.5">Table Name</label>
      <input id="name" name="name" type="text" required placeholder="The Lost Mines of Phandelver"
        class="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent" />
    </div>
    <div>
      <label for="description" class="block text-sm font-medium text-stone-300 mb-1.5">Description</label>
      <textarea id="description" name="description" rows="3" placeholder="A brief description of your campaign..."
        class="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-md text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent resize-none"></textarea>
    </div>
    <div>
      <label for="system" class="block text-sm font-medium text-stone-300 mb-1.5">System</label>
      <input id="system" name="system_name" type="text" value="D&D 5e"
        class="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-md text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent" />
    </div>
    <div>
      <label for="edition" class="block text-sm font-medium text-stone-300 mb-1.5">Edition</label>
      <input id="edition" name="edition" type="text" value="2024"
        class="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-md text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent" />
    </div>
    <div>
      <label for="timezone" class="block text-sm font-medium text-stone-300 mb-1.5">Timezone</label>
      <select id="timezone" name="timezone"
        class="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-md text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent">
        {#each timezones as tz}
          <option value={tz}>{tz}</option>
        {/each}
      </select>
    </div>
    <div class="flex gap-4 pt-2">
      <a href="/tables" class="px-5 py-2.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-md transition-colors font-medium">Cancel</a>
      <button type="submit" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-md transition-colors">Create Table</button>
    </div>
  </form>
</div>
