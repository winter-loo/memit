<script>
  import { page } from '$app/stores';
  import { createClient } from '@supabase/supabase-js';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
  import { onMount } from 'svelte';

  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;
  /** @type {import('@supabase/supabase-js').User | null} */
  let user = $state(null);

  onMount(async () => {
    supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    const { data } = await supabase.auth.getUser();
    user = data.user;

    supabase.auth.onAuthStateChange((_event, session) => {
      user = session?.user ?? null;
    });
  });

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.reload();
  }
</script>

<aside
  class="hidden lg:flex w-72 flex-shrink-0 border-r-2 border-slate-100 dark:border-slate-800 flex-col sticky top-0 h-screen px-6 py-8"
>
  <div class="mb-12 flex items-center gap-3">
    <div
      class="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center btn-3d"
      style="border-bottom-color: #E67E00;"
    >
      <span class="material-symbols-outlined text-white text-3xl font-bold">auto_stories</span>
    </div>
    <span class="text-3xl font-fredoka font-bold tracking-tight text-primary">memit</span>
  </div>
  <nav class="space-y-4 flex-grow">
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <a
      href="/"
      class="sidebar-item-playful flex items-center gap-4 px-5 py-4 rounded-3xl font-fredoka font-bold uppercase tracking-wider text-base"
      class:active={$page.url.pathname === '/'}
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-white nav-icon-chunky"
        class:bg-primary={$page.url.pathname === '/'}
        class:bg-slate-200={$page.url.pathname !== '/'}
        class:dark:bg-slate-700={$page.url.pathname !== '/'}
      >
        <span class="material-symbols-outlined text-2xl fill-1">home</span>
      </div>
      <span>Home</span>
    </a>
    <a
      href="/practice"
      class="sidebar-item-playful flex items-center gap-4 px-5 py-4 rounded-3xl font-fredoka font-bold uppercase tracking-wider text-base text-slate-500"
      class:active={$page.url.pathname === '/practice'}
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-white nav-icon-chunky"
        class:bg-primary={$page.url.pathname === '/practice'}
        class:bg-slate-200={$page.url.pathname !== '/practice'}
        class:dark:bg-slate-700={$page.url.pathname !== '/practice'}
      >
        <span class="material-symbols-outlined text-2xl fill-1">psychology</span>
      </div>
      <span>Practice</span>
    </a>
    <a
      href="/history"
      class="sidebar-item-playful flex items-center gap-4 px-5 py-4 rounded-3xl font-fredoka font-bold uppercase tracking-wider text-base text-slate-500"
      class:active={$page.url.pathname === '/history'}
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-white nav-icon-chunky"
        class:bg-primary={$page.url.pathname === '/history'}
        class:bg-slate-200={$page.url.pathname !== '/history'}
        class:dark:bg-slate-700={$page.url.pathname !== '/history'}
      >
        <span class="material-symbols-outlined text-2xl fill-1">history</span>
      </div>
      <span>History</span>
    </a>
    <a
      href="/settings"
      class="sidebar-item-playful flex items-center gap-4 px-5 py-4 rounded-3xl font-fredoka font-bold uppercase tracking-wider text-base text-slate-500"
      class:active={$page.url.pathname === '/settings'}
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-white nav-icon-chunky"
        class:bg-primary={$page.url.pathname === '/settings'}
        class:bg-slate-200={$page.url.pathname !== '/settings'}
        class:dark:bg-slate-700={$page.url.pathname !== '/settings'}
      >
        <span class="material-symbols-outlined text-2xl fill-1">settings</span>
      </div>
      <span>Setting</span>
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  </nav>
  <div class="mt-auto">
    <div
      class="relative group p-4 bg-white dark:bg-slate-800/50 rounded-4xl border-2 border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-all"
    >
      <div class="relative">
        <img
          alt="Profile Avatar"
          class="w-14 h-14 rounded-2xl border-b-4 border-slate-200 dark:border-slate-900 object-cover"
          src={user?.user_metadata?.avatar_url ||
            'https://lh3.googleusercontent.com/aida-public/AB6AXuDeD1sN-JjGtZJLrzc_y0ZsgUsptc6gBG3NYwwjn-uGP3CNzx9iLsNzl2sOHgUNIEOPx0PDcQZJ6CTCwpr8N2U1EAWzRMQq4PQNHSeayyjTbv7ynWTDxqo_hHp7-D0E7Vf6s9e1h8z-S_Vlabz1ZKzdv2c4nz1wXmRbrJoRKUF7hRekN1W7U-g9A-oroqg2wxviPwAeuRX-47MI3y7Px56mbrLZYu7f1PjfK12GYIoDDF5-9h5uNJi3lsajYSYNiRvGau6rQ7m5ShU'}
        />
        <div
          class="absolute -top-3 -right-3 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white shadow-sm font-fredoka"
        >
          LVL 12
        </div>
      </div>
      <div class="flex-grow min-w-0">
        <p class="text-base font-fredoka font-bold text-slate-800 dark:text-white truncate">
          {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
        </p>
        <div class="flex items-center gap-1">
          <span class="material-symbols-outlined text-primary text-sm fill-1">bolt</span>
          <span class="text-xs font-bold text-primary uppercase">2,450 XP</span>
        </div>
      </div>
      <button
        onclick={handleSignOut}
        class="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ml-1 cursor-pointer"
        title="Sign out"
      >
        <span class="material-symbols-outlined text-xl">logout</span>
      </button>
    </div>
  </div>
</aside>
