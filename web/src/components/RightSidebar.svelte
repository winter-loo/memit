<script>
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { apiFetchAuthedIfSignedIn } from '$lib/api';
  import { getSupabaseClient } from '$lib/supabase';

  let dailyStudied = $state(0);
  let deckStats = $state({ new_count: 0, learning_count: 0, review_count: 0 });
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

  async function loadDeckStats() {
    try {
      const res = await apiFetchAuthedIfSignedIn(supabase, '/api/deck/stats');
      if (!res) return;
      const data = await res.json();
      deckStats = {
        new_count: coerceToInt(data?.new_count),
        learning_count: coerceToInt(data?.learning_count),
        review_count: coerceToInt(data?.review_count)
      };
    } catch (e) {
      console.error('Failed to load deck stats', e);
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
      for (const key of ['count', 'total', 'studied', 'studied_today', 'cards', 'cards_studied', 'new_count', 'learning_count', 'review_count']) {
        if (key in record) return coerceToInt(record[key]);
      }
    }
    return 0;
  }

  onMount(() => {
    supabase = getSupabaseClient();
    loadDailyTotal();
    loadDeckStats();
  });
</script>

<aside
  class="w-[380px] hidden lg:block p-8 space-y-6 dark:bg-midnight-navy border-l border-slate-100 dark:border-white/5 sticky top-0 h-screen overflow-y-auto z-20"
>
  <div class="space-y-6">
    <!-- Daily Quest Card -->
    <div
      class="bg-white dark:bg-charcoal-blue rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-xl relative group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
    >
      <div class="flex justify-between items-start mb-8 relative z-10">
        <div>
          <h3 class="font-black font-display text-xl text-slate-800 dark:text-white tracking-tight mb-1">Daily Quest</h3>
          <p class="text-[10px] text-slate-400 dark:text-text-muted uppercase tracking-[0.15em] font-black">Today's Schedule</p>
        </div>
        <div class="w-11 h-11 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center border border-primary/10 transition-transform group-hover:scale-110 duration-500">
          <span class="material-icons-round text-primary dark:text-primary-bright text-2xl">auto_awesome</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 mb-8 relative z-10">
        <div class="flex flex-col items-center p-4 bg-slate-50/50 dark:bg-midnight-navy/40 rounded-2xl border border-slate-100/50 dark:border-white/5 transition-all duration-200 hover:bg-white dark:hover:bg-charcoal-blue hover:shadow-md hover:border-blue-500/20 group/stat">
          <span class="text-[10px] font-black text-blue-500/80 dark:text-blue-400 mb-2 uppercase tracking-widest">New</span>
          <span class="text-2xl font-black text-slate-800 dark:text-white group-hover/stat:scale-110 transition-transform">{deckStats.new_count}</span>
        </div>
        <div class="flex flex-col items-center p-4 bg-slate-50/50 dark:bg-midnight-navy/40 rounded-2xl border border-slate-100/50 dark:border-white/5 transition-all duration-200 hover:bg-white dark:hover:bg-charcoal-blue hover:shadow-md hover:border-orange-500/20 group/stat">
          <span class="text-[10px] font-black text-orange-500/80 dark:text-orange-400 mb-2 uppercase tracking-widest">Learn</span>
          <span class="text-2xl font-black text-slate-800 dark:text-white group-hover/stat:scale-110 transition-transform">{deckStats.learning_count}</span>
        </div>
        <div class="flex flex-col items-center p-4 bg-slate-50/50 dark:bg-midnight-navy/40 rounded-2xl border border-slate-100/50 dark:border-white/5 transition-all duration-200 hover:bg-white dark:hover:bg-charcoal-blue hover:shadow-md hover:border-green-500/20 group/stat">
          <span class="text-[10px] font-black text-green-500/80 dark:text-green-400 mb-2 uppercase tracking-widest">Review</span>
          <span class="text-2xl font-black text-slate-800 dark:text-white group-hover/stat:scale-110 transition-transform">{deckStats.review_count}</span>
        </div>
      </div>

      <button
        onclick={() => (window.location.href = resolve('/practice'))}
        class="w-full py-4 bg-gradient-to-br from-primary to-orange-600 text-white font-black rounded-2xl text-[11px] hover:brightness-110 active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-primary/30 outline-none transition-all shadow-[0_10px_25px_-5px_rgba(255,107,0,0.4)] dark:shadow-[0_10px_25px_-5px_rgba(255,107,0,0.2)] uppercase tracking-[0.25em] cursor-pointer relative z-10 overflow-hidden group/btn"
      >
        <span class="relative z-10 flex items-center justify-center gap-2">
          Resume Training
          <span class="material-icons-round text-sm transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
        </span>
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
      </button>
    </div>

    <!-- Achievements Card -->
    <div
      class="bg-white dark:bg-charcoal-blue rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-lg"
    >
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-bold font-display text-lg text-slate-800 dark:text-white">Achievements</h3>
        <button
          class="text-primary text-sm font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
          >View All</button
        >
      </div>
      <div class="grid grid-cols-3 gap-4">
        <!-- Achievement 1 -->
        <div class="flex flex-col items-center gap-2 group cursor-pointer">
          <div
            class="w-14 h-14 rounded-full bg-slate-50 dark:bg-midnight-navy flex items-center justify-center border-2 border-primary/30 group-hover:border-primary transition-colors shadow-lg"
          >
            <span class="material-icons-round text-primary text-2xl">emoji_events</span>
          </div>
          <span
            class="text-[10px] font-bold text-center text-slate-400 dark:text-text-muted group-hover:text-slate-800 dark:group-hover:text-white uppercase tracking-wider"
            >Word Smith</span
          >
        </div>
        <!-- Achievement 2 -->
        <div class="flex flex-col items-center gap-2 group cursor-pointer">
          <div
            class="w-14 h-14 rounded-full bg-slate-50 dark:bg-midnight-navy flex items-center justify-center border-2 border-slate-100 dark:border-white/10 group-hover:border-primary transition-colors"
          >
            <span
              class="material-icons-round text-slate-300 dark:text-gray-500 group-hover:text-primary text-2xl transition-colors"
              >psychology</span
            >
          </div>
          <span
            class="text-[10px] font-bold text-center text-slate-400 dark:text-text-muted group-hover:text-slate-800 dark:group-hover:text-white uppercase tracking-wider"
            >Memory King</span
          >
        </div>
        <!-- Achievement 3 -->
        <div class="flex flex-col items-center gap-2 group cursor-pointer">
          <div
            class="w-14 h-14 rounded-full bg-slate-50 dark:bg-midnight-navy flex items-center justify-center border-2 border-slate-100 dark:border-white/10 group-hover:border-primary transition-colors"
          >
            <span
              class="material-icons-round text-slate-300 dark:text-gray-500 group-hover:text-primary text-2xl transition-colors"
              >auto_stories</span
            >
          </div>
          <span
            class="text-[10px] font-bold text-center text-slate-400 dark:text-text-muted group-hover:text-slate-800 dark:group-hover:text-white uppercase tracking-wider"
            >Reader</span
          >
        </div>
      </div>
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
        >© {currentYear} MEMIT</span
      >
    </div>
  </div>
</aside>
