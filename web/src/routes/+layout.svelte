<script>
  import '../app.css';
  import Sidebar from '../components/Sidebar.svelte';
  import RightSidebar from '../components/RightSidebar.svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
  import { createClient } from '@supabase/supabase-js';

  let { children } = $props();

  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;
  /** @type {import('@supabase/supabase-js').Session | null} */
  let session = $state(null);
  let loading = $state(true);

  let isPractice = $derived($page.url.pathname.startsWith('/practice'));
  let isHome = $derived($page.url.pathname === '/');

  onMount(async () => {
    supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    const { data } = await supabase.auth.getSession();
    session = data.session;

    supabase.auth.onAuthStateChange((_event, _session) => {
      session = _session;
    });

    loading = false;
  });
</script>

{#if loading}
  <div class="min-h-screen flex items-center justify-center bg-white dark:bg-background-dark">
    <div
      class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
    ></div>
  </div>
{:else if !session || isPractice}
  {@render children()}
{:else}
  <div class="max-w-7xl mx-auto flex min-h-screen">
    <Sidebar />
    <main
      class="flex-grow border-r-2 border-slate-100 dark:border-slate-800 bg-slate-50/50 {isHome
        ? 'max-w-2xl'
        : 'w-full'}"
    >
      {@render children()}
    </main>
    {#if isHome}
      <RightSidebar />
    {/if}
  </div>
  <div
    class="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-background-dark border-t-2 border-slate-100 dark:border-slate-800 flex justify-around items-center py-4 px-6 z-50"
  >
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <a class="text-primary" href="/"
      ><span class="material-symbols-outlined text-3xl fill-1">home</span></a
    >
    <a class="text-slate-400" href="/practice"
      ><span class="material-symbols-outlined text-3xl">psychology</span></a
    >
    <a class="text-slate-400" href="/history"
      ><span class="material-symbols-outlined text-3xl">history</span></a
    >
    <a class="text-slate-400" href="/settings"
      ><span class="material-symbols-outlined text-3xl">settings</span></a
    >
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  </div>
{/if}
