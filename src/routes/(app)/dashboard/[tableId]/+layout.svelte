<script lang="ts">
  import { page } from '$app/stores';
  import { redirect } from '@sveltejs/kit';

  let { data, children } = $props();
  const isDm = data?.role === 'dm';
  const tid = data?.table?.id || '';

  const navItems = [
    { href: `/dashboard/${tid}`, label: 'Dashboard', exact: true },
    { href: `/dashboard/${tid}/requests`, label: 'Requests' },
    { href: `/dashboard/${tid}/party`, label: 'Party' },
    { href: `/dashboard/${tid}/notes`, label: 'Notes' },
    { href: `/dashboard/${tid}/log`, label: 'Activity Log' },
    { href: `/dashboard/${tid}/settings`, label: 'Settings' },
  ];

  function isActive(href: string, exact = false) {
    const path = $page.url.pathname;
    if (exact) return path === href;
    return path.startsWith(href);
  }

  // Alias for template references
  const safe_table = $derived(data?.table);
  const safe_role = $derived(data?.role);
  const safe_userId = $derived(data?.userId);
</script>

<svelte:head>
  <title>{safe_table.name} — Session Master</title>
</svelte:head>

<div class="flex min-h-screen bg-stone-950">
  <aside class="w-56 bg-stone-900 border-r border-stone-800 flex-shrink-0">
    <div class="p-4 border-b border-stone-800">
      <h2 class="font-semibold text-amber-500 text-sm truncate">{safe_table.name}</h2>
      <p class="text-stone-500 text-xs mt-0.5">{safe_table.systemName}</p>
    </div>
    <nav class="p-2 space-y-1">
      {#each navItems as item}
        <a
          href={item.href}
          class="block px-3 py-2 text-sm rounded {isActive(item.href, item.exact)
            ? 'text-stone-200 bg-stone-800'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
        >
          {item.label}
        </a>
      {/each}
      {#if isDm}
        <div class="border-t border-stone-800 my-2"></div>
        <a
          href={`/dashboard/${tid}/dm/queue`}
          class="block px-3 py-2 text-sm rounded {isActive('/dashboard/' + tid + '/dm')
            ? 'text-stone-200 bg-stone-800'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
        >
          DM Queue
        </a>
        <a
          href={`/dashboard/${tid}/dm/ai-settings`}
          class="block px-3 py-2 text-sm rounded {isActive('/dashboard/' + tid + '/dm/ai-settings')
            ? 'text-stone-200 bg-stone-800'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
        >
          AI Settings
        </a>
        <a
          href={`/dashboard/${tid}/dm/ai-jobs`}
          class="block px-3 py-2 text-sm rounded {isActive('/dashboard/' + tid + '/dm/ai-jobs')
            ? 'text-stone-200 bg-stone-800'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
        >
          AI Jobs
        </a>
        <a
          href={`/dashboard/${tid}/dm/loot`}
          class="block px-3 py-2 text-sm rounded {isActive('/dashboard/' + tid + '/dm/loot')
            ? 'text-stone-200 bg-stone-800'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
        >
          🗝️ Loot & Shops
        </a>
      {/if}
      <div class="border-t border-stone-800 my-2"></div>
      <a href="/dashboard" class="block px-3 py-2 text-sm text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded">
        ← All Tables
      </a>
    </nav>
  </aside>

  <main class="flex-1 overflow-auto">
    {@render children()}
  </main>
</div>
