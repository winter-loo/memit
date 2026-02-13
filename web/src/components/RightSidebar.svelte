<script>
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { apiFetchAuthedIfSignedIn } from '$lib/api';
  import { getSupabaseClient } from '$lib/supabase';

  let dailyStudied = $state(0);
  const dailyGoal = 5;
  const currentYear = new Date().getFullYear();
  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;

  async function loadDailyTotal() {
    try {
      const res = await apiFetchAuthedIfSignedIn(supabase, '/api/note/studied_today');
      if (!res) return;
      const data = await res.json();
      dailyStudied = coerceToInt(data?.msg ?? data);
    } catch (e) {
      console.error('Failed to load daily total', e);
    }
  }

  /** @param {any} v */
  function coerceToInt(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
    if (typeof v === 'string') {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : 0;
    }
    if (v && typeof v === 'object') {
      const record = v;
      for (const key of ['count', 'total', 'studied', 'studied_today', 'cards', 'cards_studied']) {
        if (key in record) return coerceToInt(record[key]);
      }
    }
    return 0;
  }

  onMount(() => {
    supabase = getSupabaseClient();
    loadDailyTotal();
  });
</script>

<aside
  class="w-[380px] hidden lg:block p-8 space-y-6 bg-white dark:bg-midnight-navy border-l border-slate-100 dark:border-white/5 sticky top-0 h-screen overflow-y-auto z-20"
>
  <div class="space-y-6">
    <!-- Daily Quest Card -->
    <div class="bg-white dark:bg-charcoal-blue rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-lg relative group overflow-hidden">
      <div class="flex justify-between items-center mb-4 relative z-10">
        <h3 class="font-bold font-display text-lg text-slate-800 dark:text-white">Daily Quest</h3>
        <span class="bg-primary/20 text-primary dark:text-primary-bright text-xs px-2 py-1 rounded-full font-bold relative z-10">
          {dailyStudied}/{dailyGoal}
        </span>
      </div>
      <div class="relative w-full h-3 bg-slate-100 dark:bg-midnight-navy rounded-full overflow-hidden mb-4 z-10">
        <div 
          class="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full shadow-[0_0_10px_rgba(255,140,0,0.5)] transition-all duration-1000"
          style="width: {Math.min(100, (dailyStudied / dailyGoal) * 100)}%"
        ></div>
      </div>
      <p class="text-sm text-slate-500 dark:text-text-muted mb-4 relative z-10">
        {dailyStudied >= dailyGoal ? 'Goal achieved! Maintain your streak!' : `Review ${dailyGoal - dailyStudied} more words to maintain your streak!`}
      </p>
      <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-midnight-navy/50 rounded-xl relative z-10">
        <div class="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
          <span class="material-icons-round text-orange-500 text-sm">local_fire_department</span>
        </div>
        <div>
          <p class="text-xs text-slate-400 dark:text-text-muted">Current Streak</p>
          <p class="text-sm font-bold text-slate-800 dark:text-white">12 Days 🔥</p>
        </div>
      </div>
      <button
        onclick={() => (window.location.href = resolve('/practice'))}
        class="w-full mt-4 py-3 bg-primary text-white font-bold rounded-xl text-sm hover:brightness-105 transition-all shadow-lg uppercase tracking-wide cursor-pointer relative z-10"
      >
        Go to Practice
      </button>
    </div>

    <!-- Achievements Card -->
    <div class="bg-white dark:bg-charcoal-blue rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-lg">
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-bold font-display text-lg text-slate-800 dark:text-white">Achievements</h3>
        <button class="text-primary text-sm font-bold hover:underline bg-transparent border-none p-0 cursor-pointer">View All</button>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <!-- Achievement 1 -->
        <div class="flex flex-col items-center gap-2 group cursor-pointer">
          <div class="w-14 h-14 rounded-full bg-slate-50 dark:bg-midnight-navy flex items-center justify-center border-2 border-primary/30 group-hover:border-primary transition-colors shadow-lg">
            <span class="material-icons-round text-primary text-2xl">emoji_events</span>
          </div>
          <span class="text-[10px] font-bold text-center text-slate-400 dark:text-text-muted group-hover:text-slate-800 dark:group-hover:text-white uppercase tracking-wider">Word Smith</span>
        </div>
        <!-- Achievement 2 -->
        <div class="flex flex-col items-center gap-2 group cursor-pointer">
          <div class="w-14 h-14 rounded-full bg-slate-50 dark:bg-midnight-navy flex items-center justify-center border-2 border-slate-100 dark:border-white/10 group-hover:border-primary transition-colors">
            <span class="material-icons-round text-slate-300 dark:text-gray-500 group-hover:text-primary text-2xl transition-colors">psychology</span>
          </div>
          <span class="text-[10px] font-bold text-center text-slate-400 dark:text-text-muted group-hover:text-slate-800 dark:group-hover:text-white uppercase tracking-wider">Memory King</span>
        </div>
        <!-- Achievement 3 -->
        <div class="flex flex-col items-center gap-2 group cursor-pointer">
          <div class="w-14 h-14 rounded-full bg-slate-50 dark:bg-midnight-navy flex items-center justify-center border-2 border-slate-100 dark:border-white/10 group-hover:border-primary transition-colors">
            <span class="material-icons-round text-slate-300 dark:text-gray-500 group-hover:text-primary text-2xl transition-colors">auto_stories</span>
          </div>
          <span class="text-[10px] font-bold text-center text-slate-400 dark:text-text-muted group-hover:text-slate-800 dark:group-hover:text-white uppercase tracking-wider">Reader</span>
        </div>
      </div>
    </div>

    <!-- Quick Review / Lightning Round -->
    <div class="bg-gradient-to-br from-primary to-orange-700 rounded-3xl p-6 text-white shadow-lg shadow-primary/20 relative overflow-hidden">
      <!-- Decorative background circle -->
      <div class="absolute -right-6 -top-6 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>
      <h3 class="font-bold font-display text-lg mb-2 relative z-10">Lightning Round</h3>
      <p class="text-sm text-white/80 mb-4 relative z-10">Test yourself with 10 rapid-fire definitions.</p>
      <button 
        onclick={() => (window.location.href = resolve('/practice'))}
        class="w-full py-3 bg-white text-primary font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors shadow-lg relative z-10 cursor-pointer"
      >
        Start Now
      </button>
    </div>

    <div
      class="mt-auto pt-4 text-[10px] font-bold text-slate-400 dark:text-text-muted flex flex-wrap gap-3"
    >
      <button type="button" class="hover:text-slate-800 dark:hover:text-white transition-colors"
        >About</button
      >
      <button type="button" class="hover:text-slate-800 dark:hover:text-white transition-colors"
        >Store</button
      >
      <button type="button" class="hover:text-slate-800 dark:hover:text-white transition-colors"
        >Help</button
      >
      <button type="button" class="hover:text-slate-800 dark:hover:text-white transition-colors"
        >Privacy</button
      >
      <span class="block w-full text-slate-300 dark:text-white/20 font-normal mt-2"
        >© {currentYear} MEMIT</span>
    </div>
  </div>
</aside>
