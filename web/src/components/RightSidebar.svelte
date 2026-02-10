<script>
  import { onMount } from 'svelte';
  import {
    PUBLIC_API_BASE_URL,
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY
  } from '$env/static/public';
  import { createClient } from '@supabase/supabase-js';
  import { resolve } from '$app/paths';

  let dailyStudied = $state(0);
  const dailyGoal = 5;
  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;

  const API_BASE = (PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

  async function getAccessToken() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.access_token || null;
  }

  async function loadDailyTotal() {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/note/studied_today`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.ok) {
        const data = await res.json();
        dailyStudied = coerceToInt(data?.msg ?? data);
      }
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
    supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    loadDailyTotal();
  });
</script>

<aside
  class="w-[380px] hidden lg:block p-8 space-y-8 bg-slate-50/30 border-l-2 border-slate-100 dark:border-slate-800 sticky top-0 h-screen overflow-y-auto"
>
  <div class="space-y-8">
    <div
      class="card-3d-soft bg-white dark:bg-card-dark rounded-4xl p-6 relative overflow-hidden group"
    >
      <div class="relative z-10">
        <h3
          class="text-2xl font-fredoka font-bold mb-1 flex items-center gap-2 text-slate-800 dark:text-white"
        >
          Daily Quest
        </h3>
        <p class="text-sm font-bold text-slate-500 mb-6 uppercase tracking-wider">
          Master {dailyGoal} new words
        </p>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="font-fredoka font-bold text-primary text-lg"
              >{dailyStudied} / {dailyGoal}</span
            >
            <span class="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-1 rounded-lg"
              >+50 XP</span
            >
          </div>
          <div
            class="progress-3d shadow-inner h-[18px] bg-[#F3F4F6] rounded-full relative overflow-hidden"
          >
            <div
              class="progress-fill-3d h-full rounded-full relative shadow-[inset_0_4px_0_rgba(255,255,255,0.3)] bg-gradient-to-r from-[#FFB347] to-[#FF8C00] transition-all duration-1000"
              style="width: {Math.min(100, (dailyStudied / dailyGoal) * 100)}%"
            ></div>
          </div>
          <a
            href={resolve('/practice')}
            class="block w-full text-center bg-primary btn-3d border-b-primary-dark text-white font-fredoka font-bold uppercase py-4 rounded-2xl text-sm tracking-widest hover:brightness-105 transition-all mt-2 cursor-pointer"
          >
            Go to Practice
          </a>
        </div>
      </div>
      <div class="absolute -right-4 top-2 transition-transform group-hover:-translate-x-2">
        <div
          class="w-24 h-24 bg-accent rounded-full flex items-center justify-center border-4 border-white shadow-lg overflow-hidden relative"
        >
          <span class="material-symbols-outlined text-white text-6xl translate-y-2 fill-1"
            >face</span
          >
        </div>
      </div>
    </div>

    <div class="card-3d-soft bg-white dark:bg-card-dark rounded-4xl p-6">
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-fredoka font-bold text-slate-800 dark:text-white">Achievements</h3>
        <button
          class="text-xs font-bold text-accent uppercase tracking-widest hover:underline bg-transparent border-none p-0 cursor-pointer"
          >View all</button
        >
      </div>
      <div class="grid grid-cols-4 gap-3">
        <div
          class="aspect-square bg-primary/10 border-2 border-primary/20 rounded-2xl flex items-center justify-center group cursor-pointer hover:scale-110 transition-transform shadow-sm"
        >
          <span class="material-symbols-outlined text-primary text-3xl fill-1">military_tech</span>
        </div>
        <div
          class="aspect-square bg-accent/10 border-2 border-accent/20 rounded-2xl flex items-center justify-center group cursor-pointer hover:scale-110 transition-transform shadow-sm"
        >
          <span class="material-symbols-outlined text-accent text-3xl fill-1"
            >workspace_premium</span
          >
        </div>
        <div
          class="aspect-square bg-danger/10 border-2 border-danger/20 rounded-2xl flex items-center justify-center group cursor-pointer hover:scale-110 transition-transform shadow-sm"
        >
          <span class="material-symbols-outlined text-danger text-3xl fill-1">stars</span>
        </div>
        <div
          class="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center text-slate-300"
        >
          <span class="material-symbols-outlined text-2xl">lock</span>
        </div>
      </div>
      <div class="mt-6 flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
        <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span class="material-symbols-outlined text-primary text-xl">emoji_events</span>
        </div>
        <div>
          <p class="text-[11px] font-bold text-slate-400 uppercase leading-none mb-1">Status</p>
          <p class="text-xs font-fredoka font-bold text-slate-700 dark:text-slate-300">
            3 of 24 Badges Collected
          </p>
        </div>
      </div>
    </div>

    <div
      class="px-4 text-[11px] font-bold text-slate-400 uppercase flex flex-wrap gap-x-4 gap-y-2 opacity-70"
    >
      <!-- svelte-ignore a11y_invalid_attribute -->
      <!-- eslint-disable svelte/no-navigation-without-resolve -->
      <a class="hover:text-primary transition-colors" href="javascript:void(0)">About</a>
      <!-- svelte-ignore a11y_invalid_attribute -->
      <a class="hover:text-primary transition-colors" href="javascript:void(0)">Store</a>
      <!-- svelte-ignore a11y_invalid_attribute -->
      <a class="hover:text-primary transition-colors" href="javascript:void(0)">Help</a>
      <!-- svelte-ignore a11y_invalid_attribute -->
      <a class="hover:text-primary transition-colors" href="javascript:void(0)">Privacy</a>
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
      <span>© 2024 MEMIT</span>
    </div>
  </div>
</aside>
