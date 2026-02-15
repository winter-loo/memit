<script>
  import '../app.css';
  import Sidebar from '../components/Sidebar.svelte';
  import RightSidebar from '../components/RightSidebar.svelte';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { isExtensionAuthFlowHref } from '$lib/extension-auth';
  import { getSupabaseClient } from '$lib/supabase';
  import { initTheme } from '$lib/theme.svelte';

  let { children } = $props();

  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;
  /** @type {import('@supabase/supabase-js').Session | null} */
  let session = $state(null);
  let loading = $state(true);

  let isPractice = $derived(page.url.pathname.startsWith('/practice'));
  let isHome = $derived(page.url.pathname === '/');
  let isExtensionAuthFlow = $derived.by(() => isExtensionAuthFlowHref(page.url.href));

  onMount(() => {
    initTheme();
    supabase = getSupabaseClient();
    let active = true;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, _session) => {
      if (!active) return;
      const prevToken = session?.access_token || null;
      const nextToken = _session?.access_token || null;
      if (prevToken === nextToken) return;
      session = _session;
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      session = data.session;
      loading = false;
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  });
</script>

{#if loading}
  <div class="min-h-screen flex items-center justify-center bg-white dark:bg-background-dark">
    <div
      class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
    ></div>
  </div>
{:else if !session || isPractice || isExtensionAuthFlow}
  {@render children()}
{:else}
  <div class="max-w-7xl mx-auto flex min-h-screen">
    <Sidebar />
    <main
      class="flex-grow w-full bg-slate-50/50 dark:bg-midnight-navy lg:border-r border-slate-100 dark:border-white/5 {isHome
        ? 'lg:max-w-2xl'
        : ''} pb-28 lg:pb-0"
    >
      {@render children()}
    </main>
    {#if isHome}
      <RightSidebar />
    {/if}
  </div>
  <div
    class="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-midnight-navy/95 backdrop-blur-sm border-t border-slate-100 dark:border-white/5 flex justify-around items-center py-3 px-4 z-50"
  >
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <a
      class={page.url.pathname === '/' ? 'text-primary' : 'text-slate-400 dark:text-text-muted'}
      href="/"
    >
      <span class="material-icons-round text-3xl">home</span>
    </a>
    <a
      class={page.url.pathname.startsWith('/practice')
        ? 'text-primary'
        : 'text-slate-400 dark:text-text-muted'}
      href="/practice"
    >
      <span class="material-icons-round text-3xl">psychology</span>
    </a>
    <a
      class={page.url.pathname.startsWith('/history')
        ? 'text-primary'
        : 'text-slate-400 dark:text-text-muted'}
      href="/history"
    >
      <span class="material-icons-round text-3xl">history</span>
    </a>
    <a
      class={page.url.pathname.startsWith('/settings')
        ? 'text-primary'
        : 'text-slate-400 dark:text-text-muted'}
      href="/settings"
    >
      <span class="material-icons-round text-3xl">settings</span>
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  </div>
{/if}
