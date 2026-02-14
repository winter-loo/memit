<script>
  import { onMount } from 'svelte';
  import { getTheme, setTheme } from '$lib/theme.svelte';
  import { getSupabaseClient } from '$lib/supabase';

  let currentTheme = $derived(getTheme());

  /** @type {import('@supabase/supabase-js').SupabaseClient | undefined} */
  let supabase;
  /** @type {import('@supabase/supabase-js').User | null} */
  let user = $state(null);

  onMount(() => {
    supabase = getSupabaseClient();
    let active = true;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const prevUserId = user?.id || null;
      const nextUserId = session?.user?.id || null;
      if (prevUserId === nextUserId) return;
      user = session?.user ?? null;
    });

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      user = data.user;
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  });

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.reload();
  }
</script>

<div class="p-4 sm:p-8">
  <h1 class="text-3xl font-fredoka font-bold text-slate-800 dark:text-slate-100">Settings</h1>
  <p class="text-slate-500 dark:text-slate-400 font-medium mb-8">
    Manage your account and preferences
  </p>

  <section class="max-w-2xl space-y-6">
    <!-- Account (small screens only; large screens have the sidebar card) -->
    <div
      class="lg:hidden bg-white dark:bg-card-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800"
    >
      <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">account_circle</span>
        Account
      </h2>

      <div class="flex items-center gap-4">
        <img
          alt="Profile Avatar"
          class="w-14 h-14 rounded-2xl border-b-4 border-slate-200 dark:border-slate-900 object-cover"
          src={user?.user_metadata?.avatar_url ||
            'https://lh3.googleusercontent.com/aida-public/AB6AXuDeD1sN-JjGtZJLrzc_y0ZsgUsptc6gBG3NYwwjn-uGP3CNzx9iLsNzl2sOHgUNIEOPx0PDcQZJ6CTCwpr8N2U1EAWzRMQq4PQNHSeayyjTbv7ynWTDxqo_hHp7-D0E7Vf6s9e1h8z-S_Vlabz1ZKzdv2c4nz1wXmRbrJoRKUF7hRekN1W7U-g9A-oroqg2wxviPwAeuRX-47MI3y7Px56mbrLZYu7f1PjfK12GYIoDDF5-9h5uNJi3lsajYSYNiRvGau6rQ7m5ShU'}
        />

        <div class="flex-grow min-w-0">
          <p class="text-base font-fredoka font-bold text-slate-800 dark:text-white truncate">
            {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
          </p>
          {#if user?.email}
            <p class="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          {/if}
        </div>

        <button
          onclick={handleSignOut}
          class="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors cursor-pointer"
          title="Sign out"
        >
          <span class="material-symbols-outlined text-xl">logout</span>
        </button>
      </div>
    </div>

    <div class="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
      <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">palette</span>
        Appearance
      </h2>
      
      <div class="grid grid-cols-3 gap-4">
        <button
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 {currentTheme === 'light' ? 'border-primary bg-orange-50 dark:bg-orange-900/20 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'}"
          onclick={() => setTheme('light')}
        >
          <span class="material-symbols-outlined text-3xl mb-2">light_mode</span>
          <span class="font-medium">Light</span>
        </button>
        
        <button
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 {currentTheme === 'dark' ? 'border-primary bg-orange-50 dark:bg-orange-900/20 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'}"
          onclick={() => setTheme('dark')}
        >
          <span class="material-symbols-outlined text-3xl mb-2">dark_mode</span>
          <span class="font-medium">Dark</span>
        </button>
        
        <button
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 {currentTheme === 'system' ? 'border-primary bg-orange-50 dark:bg-orange-900/20 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'}"
          onclick={() => setTheme('system')}
        >
          <span class="material-symbols-outlined text-3xl mb-2">contrast</span>
          <span class="font-medium">System</span>
        </button>
      </div>
    </div>
  </section>
</div>
