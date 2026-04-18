<script lang="ts">
  import { page } from '$app/stores';

  let { data, children } = $props();
  const isDm = data?.role === 'dm';
  const tid = data?.table?.id || '';

  let mobileMenuOpen = $state(false);

  const navItems = [
    { href: `/dashboard/${tid}`, label: 'Dashboard', icon: '📊', exact: true },
    { href: `/dashboard/${tid}/party`, label: 'Party', icon: '⚔️' },
    { href: `/dashboard/${tid}/requests`, label: 'Requests', icon: '📋' },
    { href: `/dashboard/${tid}/notes`, label: 'Notes', icon: '📝' },
    { href: `/dashboard/${tid}/dice`, label: 'Dice', icon: '🎲' },
    { href: `/dashboard/${tid}/log`, label: 'Log', icon: '📜' },
    { href: `/dashboard/${tid}/settings`, label: 'Settings', icon: '⚙️' },
  ];

  const dmNavItems = [
    { href: `/dashboard/${tid}/dm/queue`, label: 'DM Queue', icon: '📨' },
    { href: `/dashboard/${tid}/dm/ai-settings`, label: 'AI Settings', icon: '🤖' },
    { href: `/dashboard/${tid}/dm/ai-jobs`, label: 'AI Jobs', icon: '⚡' },
    { href: `/dashboard/${tid}/dm/loot`, label: 'Loot & Shops', icon: '🗝️' },
  ];

  // Bottom nav items for mobile (compact)
  const bottomNavItems = [
    { href: `/dashboard/${tid}`, label: 'Home', icon: '📊', exact: true },
    { href: `/dashboard/${tid}/party`, label: 'Party', icon: '⚔️' },
    { href: `/dashboard/${tid}/requests`, label: 'Requests', icon: '📋' },
    { href: `/dashboard/${tid}/notes`, label: 'Notes', icon: '📝' },
    { href: `/dashboard/${tid}/dice`, label: 'Dice', icon: '🎲' },
  ];

  function isActive(href: string, exact = false) {
    const path = $page.url.pathname;
    if (exact) return path === href;
    return path.startsWith(href);
  }

  function closeMobile() { mobileMenuOpen = false; }

  // Alias for template references
  const safe_table = $derived(data?.table);
</script>

<svelte:head>
  <title>{safe_table.name} — Session Master</title>
</svelte:head>

<div class="flex min-h-screen bg-stone-950">
  <!-- Desktop Sidebar -->
  <aside class="hidden md:flex w-56 bg-stone-900 border-r border-stone-800 flex-shrink-0 flex-col">
    <div class="p-4 border-b border-stone-800">
      <h2 class="font-semibold text-amber-500 text-sm truncate">{safe_table.name}</h2>
      <p class="text-stone-500 text-xs mt-0.5">{safe_table.systemName}</p>
    </div>
    <nav class="p-2 space-y-1 flex-1 overflow-auto">
      {#each navItems as item}
        <a
          href={item.href}
          class="block px-3 py-2 text-sm rounded {isActive(item.href, item.exact)
            ? 'text-stone-200 bg-stone-800'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
        >
          {item.icon} {item.label}
        </a>
      {/each}
      {#if isDm}
        <div class="border-t border-stone-800 my-2"></div>
        {#each dmNavItems as item}
          <a
            href={item.href}
            class="block px-3 py-2 text-sm rounded {isActive(item.href)
              ? 'text-stone-200 bg-stone-800'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
          >
            {item.icon} {item.label}
          </a>
        {/each}
      {/if}
      <div class="border-t border-stone-800 my-2"></div>
      <a href="/dashboard" class="block px-3 py-2 text-sm text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded">
        ← All Tables
      </a>
    </nav>
  </aside>

  <!-- Mobile Menu Overlay -->
  {#if mobileMenuOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-50 md:hidden" onclick={closeMobile}>
      <div class="absolute inset-0 bg-black/60"></div>
      <div class="absolute right-0 top-0 bottom-0 w-72 bg-stone-900 border-l border-stone-800 overflow-auto"
        onclick={(e) => e.stopPropagation()}>
        <div class="p-4 border-b border-stone-800 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-amber-500 text-sm truncate">{safe_table.name}</h2>
            <p class="text-stone-500 text-xs mt-0.5">{safe_table.systemName}</p>
          </div>
          <button onclick={closeMobile} class="p-2 text-stone-400 hover:text-stone-200" aria-label="Close menu">✕</button>
        </div>
        <nav class="p-2 space-y-1">
          {#each navItems as item}
            <a
              href={item.href}
              onclick={closeMobile}
              class="flex items-center gap-3 px-3 py-3 text-sm rounded min-h-[44px] {isActive(item.href, item.exact)
                ? 'text-stone-200 bg-stone-800'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
            >
              <span class="text-lg">{item.icon}</span>
              {item.label}
            </a>
          {/each}
          {#if isDm}
            <div class="border-t border-stone-800 my-2"></div>
            {#each dmNavItems as item}
              <a
                href={item.href}
                onclick={closeMobile}
                class="flex items-center gap-3 px-3 py-3 text-sm rounded min-h-[44px] {isActive(item.href)
                  ? 'text-stone-200 bg-stone-800'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'}"
              >
                <span class="text-lg">{item.icon}</span>
                {item.label}
              </a>
            {/each}
          {/if}
          <div class="border-t border-stone-800 my-2"></div>
          <a href="/dashboard" class="flex items-center gap-3 px-3 py-3 text-sm text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded min-h-[44px]">
            <span class="text-lg">🏠</span>
            All Tables
          </a>
        </nav>
      </div>
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex-1 flex flex-col min-h-screen overflow-auto pb-16 md:pb-0">
    <!-- Mobile Header -->
    <header class="md:hidden flex items-center justify-between px-4 py-3 bg-stone-900 border-b border-stone-800 flex-shrink-0">
      <h2 class="font-semibold text-amber-500 text-sm truncate">{safe_table.name}</h2>
      <button onclick={() => mobileMenuOpen = !mobileMenuOpen} class="p-2 text-stone-300 hover:text-stone-100 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Open menu">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </header>

    <main class="flex-1">
      {@render children()}
    </main>
  </div>

  <!-- Mobile Bottom Nav -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-900 border-t border-stone-800 safe-area-inset">
    <div class="flex justify-around items-center">
      {#each bottomNavItems as item}
        <a
          href={item.href}
          class="flex flex-col items-center justify-center py-2 px-1 min-w-[56px] min-h-[56px]
            {isActive(item.href, item.exact)
              ? 'text-amber-500'
              : 'text-stone-500 hover:text-stone-300'}"
        >
          <span class="text-lg leading-none">{item.icon}</span>
          <span class="text-[10px] mt-0.5 leading-tight">{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>
</div>
