<script>
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { withPreparedFields } from '$lib/notes';
  import { getSupabaseClient } from '$lib/supabase';
  import { apiFetchAuthed } from '$lib/api';

  /** @typedef {{ id: string | number, fields?: Record<string, string>, _term?: string, _translation?: string, _simpleDefinition?: string, _examples?: string[], _synonyms?: string[], _detailedExplanation?: string, _etymology?: string, _antonyms?: string[] }} Note */
  /** @typedef {{ simpleDefinition?: string, translation?: string, examples?: string[], synonyms?: string[], detailedExplanation?: string, etymology?: string, antonyms?: string[] }} CardDetails */

  let view = $state('loading'); // loading, question, answer, complete, unauthenticated
  let currentCardData = $state(
    /** @type {{ card_id: number, note: Note, queue?: number, states?: any } | null} */ (null)
  );
  let deckStats = $state({ new_count: 0, learning_count: 0, review_count: 0 });
  let initialDueTotal = $state(/** @type {number | null} */ (null));
  let reviewStats = $state(/** @type {{ timing: any, studied: any } | null} */ (null));
  let revealed = $state(false);
  let feedback = $state(''); // foggy, got_it
  let advancing = $state(false);

  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];

  /** @param {() => void} fn @param {number} ms */
  function schedule(fn, ms) {
    const id = setTimeout(() => {
      timers = timers.filter((t) => t !== id);
      fn();
    }, ms);
    timers = [...timers, id];
    return id;
  }

  function clearAllTimers() {
    for (const id of timers) clearTimeout(id);
    timers = [];
  }

  /** @param {string} key */
  function titleizeKey(key) {
    return String(key)
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** @param {number} secs */
  function formatDuration(secs) {
    if (!Number.isFinite(secs)) return '—';
    const s = Math.max(0, Math.floor(secs));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${r}s`;
    return `${r}s`;
  }

  /** @param {string} key @param {any} value @returns {string} */
  function formatTimingValue(key, value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') {
      const k = String(key).toLowerCase();
      if (k.includes('at') || k.includes('time') || k.includes('timestamp')) {
        const ms = value > 2e12 ? value : value > 1e9 ? value * 1000 : null;
        if (ms) return new Date(ms).toLocaleString();
      }
      if (k.includes('sec') || k.includes('secs') || k.includes('seconds')) return formatDuration(value);
      if (k.includes('ms') || k.includes('millis')) return formatDuration(value / 1000);
      if (k.includes('pct') || k.includes('percent')) return `${value}%`;
      return value.toLocaleString();
    }
    if (typeof value === 'string') {
      const k = String(key).toLowerCase();
      if (k.includes('at') || k.includes('time') || k.includes('timestamp')) {
        const trimmed = value.trim();
        if (/^\d+$/.test(trimmed)) {
          const num = Number(trimmed);
          const ms = num > 2e12 ? num : num > 1e9 ? num * 1000 : null;
          if (ms) return new Date(ms).toLocaleString();
        }
        const parsed = Date.parse(trimmed);
        if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleString();
      }
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '—';
      if (value.length <= 3) return value.map(String).join(', ');
      return `${value.length} items`;
    }
    if (typeof value === 'object') {
      try {
        const keys = Object.keys(value);
        if (keys.length === 0) return '—';
        if (keys.length <= 3) return keys.map((k) => `${titleizeKey(k)}: ${formatTimingValue(k, value[k])}`).join(' · ');
        return `${keys.length} fields`;
      } catch { return '—'; }
    }
    return String(value);
  }

  /** @param {string} key @returns {string} */
  function timingIcon(key) {
    const k = String(key).toLowerCase();
    if (k.includes('day')) return 'calendar_today';
    if (k.includes('learn')) return 'school';
    if (k.includes('review') || k.includes('rev')) return 'refresh';
    if (k.includes('new')) return 'fiber_new';
    if (k.includes('due')) return 'pending_actions';
    return 'schedule';
  }

  /** @param {any} state */
  function formatSchedulingTime(state) {
    if (!state) return '';
    const normal = state.normal || state.Normal;
    if (normal) {
      if (normal.learning || normal.Learning) {
        const s = (normal.learning || normal.Learning).scheduledSecs ?? (normal.learning || normal.Learning).scheduled_secs ?? 0;
        return s < 60 ? '<1m' : `${Math.floor(s / 60)}m`;
      }
      if (normal.review || normal.Review) {
        const d = (normal.review || normal.Review).scheduledDays ?? (normal.review || normal.Review).scheduled_days ?? 0;
        return d >= 30 ? `${Math.floor(d / 30)}mo` : `${d}d`;
      }
      if (normal.relearning || normal.Relearning) {
        const rl = normal.relearning || normal.Relearning;
        const l = rl.learning || rl.Learning;
        if (l) {
          const s = l.scheduledSecs ?? l.scheduled_secs ?? 0;
          return s < 60 ? '<1m' : `${Math.floor(s / 60)}m`;
        }
      }
      if (normal.new || normal.New) return 'new';
    }
    const filtered = state.filtered || state.Filtered;
    if (filtered?.preview || filtered?.Preview) {
      const s = (filtered.preview || filtered.Preview).scheduledSecs ?? (filtered.preview || filtered.Preview).scheduled_secs ?? 0;
      return s < 60 ? '<1m' : `${Math.floor(s / 60)}m`;
    }
    return '';
  }

  /** @param {Note} note @returns {CardDetails} */
  function buildCardDetails(note) {
    const prepared = withPreparedFields(note);
    return {
      simpleDefinition: prepared._simpleDefinition || undefined,
      translation: prepared._translation || undefined,
      examples: prepared._examples || [],
      synonyms: prepared._synonyms || [],
      detailedExplanation: prepared._detailedExplanation || undefined,
      etymology: prepared._etymology || undefined,
      antonyms: prepared._antonyms || []
    };
  }

  /** @param {any} stats */
  function dueRemainingFromStats(stats) {
    if (!stats || typeof stats !== 'object') return 0;
    const learn = Number(stats.learning_count ?? stats.learnCount ?? stats.learn_count ?? 0) || 0;
    const review = Number(stats.review_count ?? stats.reviewCount ?? stats.review_count ?? 0) || 0;
    const newly = Number(stats.new_count ?? stats.newCount ?? stats.new_count ?? 0) || 0;
    return learn + review + newly;
  }

  let statsPulsing = $state(false);
  function pulseStats() {
    statsPulsing = true;
    schedule(() => { statsPulsing = false; }, 600);
  }

  async function refreshStats() {
    try {
      const res = await apiFetchAuthed(supabase, '/api/deck/stats');
      if (!res) return;
      const data = await res.json();
      const changed = data.new_count !== deckStats.new_count || data.learning_count !== deckStats.learning_count || data.review_count !== deckStats.review_count;
      deckStats = data;
      if (changed) pulseStats();
    } catch (e) {
      console.error('Failed to refresh stats', e);
    }
  }

  async function loadReviewStats() {
    try {
      const [timingRes, studiedRes] = await Promise.all([
        apiFetchAuthed(supabase, '/api/card/sched_timing_today'),
        apiFetchAuthed(supabase, '/api/note/studied_today')
      ]);
      const timing = await timingRes.json().catch(() => null);
      const studied = await studiedRes.json().catch(() => null);
      reviewStats = { timing, studied };
    } catch (e) {
      console.error(e);
      reviewStats = null;
    }
  }

  async function loadNextCard() {
    try {
      const [cardRes, statsRes] = await Promise.all([
        apiFetchAuthed(supabase, '/api/card/next'),
        apiFetchAuthed(supabase, '/api/deck/stats')
      ]);
      const cardData = await cardRes.json();
      const newStats = await statsRes.json().catch(() => ({ new_count: 0, learning_count: 0, review_count: 0 }));
      deckStats = newStats;

      const remaining = dueRemainingFromStats(deckStats);
      if (initialDueTotal === null && remaining > 0) {
        initialDueTotal = remaining;
      } else if (initialDueTotal !== null && remaining > initialDueTotal) {
        initialDueTotal = remaining;
      }

      if (cardData.cards && cardData.cards.length > 0) {
        const qcard = cardData.cards[0];
        const card = qcard.card;
        const noteId = card.noteId || card.note_id;
        const noteRes = await apiFetchAuthed(supabase, `/api/note/@${noteId}`);
        const noteData = await noteRes.json();
        currentCardData = { card_id: card.id, note: noteData, queue: qcard.queue, states: qcard.states };
        view = 'question';
      } else {
        currentCardData = null;
        view = 'complete';
        void loadReviewStats();
      }
    } catch (e) {
      console.error(e);
      view = 'complete';
      void loadReviewStats();
    }
    revealed = false;
    feedback = '';
    advancing = false;
  }

  function revealAnswer() {
    revealed = true;
  }

  /** @param {'foggy' | 'got_it'} value */
  function chooseFeedback(value) {
    if (advancing) return;
    feedback = value;
    const answerGrade = value === 'foggy' ? 1 : 3;
    apiFetchAuthed(supabase, `/api/card/answer/${answerGrade}`, { method: 'POST' })
      .then(() => refreshStats())
      .catch(console.error);

    advancing = true;
    schedule(async () => {
      await loadNextCard();
    }, 400);
  }

  function nextCard() {
    if (advancing) return;
    advancing = true;
    loadNextCard();
  }

  let currentNote = $derived(currentCardData?.note || { id: -1, fields: {} });
  let preparedCurrentNote = $derived(withPreparedFields(currentNote));
  let prompt = $derived(preparedCurrentNote._term || '');
  let cardDetails = $derived(buildCardDetails(currentNote));
  let progress = $derived.by(() => {
    const total = initialDueTotal ?? 0;
    if (!total) return 0;
    const remaining = dueRemainingFromStats(deckStats);
    const done = Math.max(0, Math.min(total, total - remaining));
    return (done / total) * 100;
  });
  let foggyTime = $derived(formatSchedulingTime(currentCardData?.states?.again));
  let gotItTime = $derived(formatSchedulingTime(currentCardData?.states?.good));

  let timingItems = $derived.by(() => {
    const timing = reviewStats?.timing;
    if (!timing || typeof timing !== 'object') return [];
    return Object.entries(timing)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([key, value]) => ({
        key,
        label: titleizeKey(key),
        icon: timingIcon(key),
        valueText: formatTimingValue(key, value)
      }))
      .filter((item) => item.valueText !== '—');
  });

  onMount(() => {
    supabase = getSupabaseClient();

    /** @param {KeyboardEvent} event */
    const handleKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;

      if (event.key === ' ') {
        event.preventDefault();
        if (view === 'question' && !revealed) revealAnswer();
        else if (view === 'question' && revealed && !feedback) chooseFeedback('foggy');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (view === 'question' && !revealed) revealAnswer();
        else if (view === 'question' && revealed && !feedback) chooseFeedback('got_it');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await loadNextCard();
      } else {
        view = 'unauthenticated';
      }
    })();

    return () => {
      clearAllTimers();
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<style>
  .paper-grain::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    filter: url(#paper-noise);
    background: rgba(128, 120, 108, 0.025);
    mix-blend-mode: multiply;
    border-radius: inherit;
  }

  :global(.dark) .paper-grain::before {
    background: rgba(180, 170, 155, 0.03);
    mix-blend-mode: soft-light;
  }

  .keycap {
    box-shadow: 0 2px 0px 0px #d1d5db;
  }
  :global(.dark) .keycap {
    box-shadow: 0 2px 0px 0px #1a1a1a;
  }
  .keycap-primary {
    box-shadow: 0 2px 0px 0px #cc7000;
  }
</style>

<svg class="absolute h-0 w-0" aria-hidden="true">
  <filter id="paper-noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
</svg>

<svelte:head>
  <title>Practice</title>
</svelte:head>

{#if view === 'loading'}
  <div class="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
{:else if view === 'unauthenticated'}
  <div class="min-h-screen flex items-center justify-center px-6 bg-background-light dark:bg-background-dark">
    <div class="text-center space-y-4">
      <h1 class="text-2xl font-fredoka font-bold text-slate-800 dark:text-white">Sign in required</h1>
      <p class="text-slate-500 dark:text-slate-400">Please sign in to start practice.</p>
      <a
        href={resolve('/')}
        class="inline-block px-5 py-2.5 rounded-xl bg-primary text-white font-bold uppercase tracking-wider text-sm shadow-sm hover:brightness-105 transition-all"
      >
        Go to Login
      </a>
    </div>
  </div>
{:else if view === 'complete'}
  <div class="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-300">
    <main class="flex-1 flex flex-col items-center justify-center px-6">
      <div class="w-full max-w-[640px] flex flex-col items-center text-center gap-8">
        <div class="text-6xl">✅</div>
        <div class="space-y-2">
          <h1 class="text-4xl md:text-5xl font-bold text-primary tracking-tight">All caught up</h1>
          <p class="text-xl text-gray-500 dark:text-gray-400 font-medium">No cards due right now.</p>
        </div>

        <div class="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="bg-white dark:bg-card-dark rounded-2xl p-6 border border-slate-200/60 dark:border-white/10 text-left">
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Progress</p>
            <p class="mt-2 text-2xl font-black text-slate-800 dark:text-white">
              {reviewStats?.studied?.msg ?? 'Completed!'}
            </p>
          </div>

          <div class="bg-white dark:bg-card-dark rounded-2xl p-6 border border-slate-200/60 dark:border-white/10 text-left">
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Session Review</p>
            {#if timingItems.length > 0}
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {#each timingItems as item (item.key)}
                  <div class="rounded-xl bg-slate-50 dark:bg-white/5 px-3 py-2 border border-slate-200/60 dark:border-white/10">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[16px] text-primary">{item.icon}</span>
                      <p class="text-[9px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                    </div>
                    <p class="mt-1 text-sm font-black text-slate-700 dark:text-slate-200 break-words">{item.valueText}</p>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="mt-2 text-sm text-slate-500 dark:text-slate-400 font-bold italic">— Session Stats Finalized —</p>
            {/if}
          </div>
        </div>
      </div>
    </main>

    <footer class="w-full border-t border-slate-200/60 dark:border-white/10 p-8">
      <div class="max-w-[640px] mx-auto">
        <a
          href={resolve('/')}
          class="block w-full text-center bg-primary text-white rounded-2xl text-lg font-black uppercase tracking-[0.18em] py-4 shadow-[0_6px_0_0_#cc7000] hover:bg-[#ff9a24] hover:brightness-105 active:translate-y-1.5 active:shadow-none active:scale-[0.99] transition-all cursor-pointer"
        >
          Return to Dashboard
        </a>
      </div>
    </footer>
  </div>
{:else}
  <!-- question / answer view -->
  <div class="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-300">
    <header class="w-full max-w-[1024px] mx-auto px-6 py-8 flex items-center gap-6">
      <a
        href={resolve('/')}
        class="rounded-full text-gray-500 transition-transform hover:text-gray-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-90 motion-reduce:transition-none dark:hover:text-gray-300 dark:focus-visible:ring-primary/30"
        aria-label="Close practice"
      >
        <span class="material-symbols-outlined text-3xl font-bold">close</span>
      </a>
      <div class="flex-1 h-4 bg-gray-200 dark:bg-[#2A2A2A] rounded-full overflow-hidden shadow-inner">
        <div
          class="h-full bg-primary rounded-full relative transition-all duration-500 ease-out"
          style={`width: ${progress}%;`}
        >
          <div class="absolute top-1 left-1 right-1 h-1 bg-white/20 rounded-full"></div>
        </div>
      </div>
      <div
        class="flex items-center gap-3 sm:gap-4 font-fredoka transition-all duration-300"
        class:scale-110={statsPulsing}
      >
        <div class="flex flex-col items-center leading-none">
          <span class="text-lg font-bold text-blue-500">{deckStats.new_count}</span>
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-tighter">New</span>
        </div>
        <div class="flex flex-col items-center leading-none">
          <span class="text-lg font-bold text-orange-500">{deckStats.learning_count}</span>
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Learn</span>
        </div>
        <div class="flex flex-col items-center leading-none">
          <span class="text-lg font-bold text-green-500">{deckStats.review_count}</span>
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Rev</span>
        </div>
      </div>
    </header>

    <main class="flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pt-10">
      <section class="mx-auto w-full max-w-[720px]">
        <div class="relative pt-8 sm:pt-12">
          <div class="relative space-y-10 sm:space-y-14">
            <header class="sticky top-0 z-20 py-4 sm:py-5 -mt-4 sm:-mt-5 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md">
              <h1
                class="max-w-[20ch] text-left text-[clamp(1.5rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.03em] text-slate-900 dark:text-white"
              >
                {prompt}
              </h1>
            </header>

            <div class="relative min-h-[320px] sm:min-h-[340px]">
              <!-- Revealed answer content -->
              <div
                class={`space-y-6 border-t border-slate-300/70 pt-6 transition-all duration-500 ease-out motion-reduce:transition-none dark:border-white/10 ${
                  revealed
                    ? 'opacity-100 translate-y-0'
                    : 'pointer-events-none opacity-0 translate-y-8'
                }`}
                aria-hidden={!revealed}
              >
                <!-- 1. Simple Definition -->
                {#if cardDetails.simpleDefinition}
                  <div>
                    <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400 mb-3">Definition</p>
                    <p class="max-w-[38rem] text-lg leading-8 text-slate-800 dark:text-slate-100 sm:text-xl sm:leading-9">
                      {cardDetails.simpleDefinition}
                    </p>
                  </div>
                {/if}

                <!-- 2. Translation -->
                {#if cardDetails.translation}
                  <p class="text-xl font-bold text-primary flex items-center gap-2 font-fredoka">
                    <span class="material-symbols-outlined text-lg">translate</span>
                    {cardDetails.translation}
                  </p>
                {/if}

                <!-- 3. Examples -->
                {#if cardDetails.examples && cardDetails.examples.length > 0}
                  <div>
                    <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400 mb-3">Examples</p>
                    <ul class="space-y-2">
                      {#each cardDetails.examples as example, i (i)}
                        <li class="flex gap-2.5 text-sm leading-7 text-slate-600 dark:text-slate-300">
                          <span class="text-primary font-bold mt-0.5">•</span>
                          <span>{example}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}

                <!-- 4. Synonyms -->
                {#if cardDetails.synonyms && cardDetails.synonyms.length > 0}
                  <div>
                    <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400 mb-3">Synonyms</p>
                    <div class="flex flex-wrap gap-2">
                      {#each cardDetails.synonyms as synonym, i (i)}
                        <span class="px-2.5 py-1 text-sm rounded-lg bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-300">{synonym}</span>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- 5. Detailed Explanation -->
                {#if cardDetails.detailedExplanation}
                  <div>
                    <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400 mb-3">Explanation</p>
                    <p class="text-sm leading-7 text-slate-600 dark:text-slate-400">
                      {cardDetails.detailedExplanation}
                    </p>
                  </div>
                {/if}

                <!-- 6. Origins -->
                {#if cardDetails.etymology}
                  <div>
                    <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400 mb-3">Origins</p>
                    <p class="text-sm leading-7 text-slate-500 dark:text-slate-400 italic">
                      {cardDetails.etymology}
                    </p>
                  </div>
                {/if}

                <!-- 7. Antonyms -->
                {#if cardDetails.antonyms && cardDetails.antonyms.length > 0}
                  <div>
                    <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400 mb-3">Antonyms</p>
                    <div class="flex flex-wrap gap-2">
                      {#each cardDetails.antonyms as antonym, i (i)}
                        <span class="px-2.5 py-1 text-sm rounded-lg bg-red-50 text-red-600/80 dark:bg-red-500/10 dark:text-red-300/80">{antonym}</span>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Paper mask (before reveal) -->
              <div
                class={`absolute inset-x-0 top-0 z-10 transition-all duration-500 ease-out motion-reduce:transition-none ${
                  revealed
                    ? 'pointer-events-none translate-y-[calc(100%+2.8rem)] opacity-0 rotate-[0.45deg]'
                    : 'translate-y-0 opacity-100'
                }`}
                aria-hidden={revealed}
              >
                <button
                  class="paper-grain group relative block h-[220px] w-full overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-sm text-left transition-all duration-500 ease-out hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none cursor-pointer dark:border-white/10 dark:bg-white/5 dark:hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.4)] dark:focus-visible:ring-primary/30"
                  onclick={revealAnswer}
                >
                  <div class="relative flex h-full items-center justify-center px-8 text-center">
                    <span
                      class="text-[clamp(1.15rem,2.8vw,1.8rem)] font-bold uppercase tracking-[0.28em] text-[color:color-mix(in_srgb,var(--color-primary)_72%,#7c5b34)] transition-transform duration-200 group-hover:scale-[1.02] dark:text-[color:color-mix(in_srgb,var(--color-primary-light)_82%,#f3dec2)]"
                    >
                      Unmask It
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Fixed bottom bar -->
    <div
      class={`fixed inset-x-0 bottom-0 z-30 transition-all duration-500 ease-out ${
        revealed
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div class="bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-lg border-t border-slate-200/60 dark:border-white/10">
        <div class="mx-auto max-w-[720px] px-6 py-4 flex items-center justify-center gap-4">
          <button
            disabled={advancing}
            class="flex-1 h-14 rounded-2xl text-base font-black uppercase tracking-widest flex items-center justify-center gap-2 bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-[#333333] text-gray-500 dark:text-gray-300 shadow-[0_4px_0_0_#e5e7eb] dark:shadow-[0_4px_0_0_#1a1a1a] hover:bg-slate-50 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={() => chooseFeedback('foggy')}
          >
            <span>Foggy</span>
            {#if foggyTime}
              <span class="keycap inline-flex items-center justify-center bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-gray-700 text-[10px] text-gray-400 px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]">{foggyTime}</span>
            {/if}
          </button>
          <button
            disabled={advancing}
            class="flex-1 h-14 rounded-2xl text-base font-black uppercase tracking-widest flex items-center justify-center gap-2 bg-primary text-white shadow-[0_4px_0_0_#cc7000] hover:bg-[#ff9a24] hover:brightness-105 active:translate-y-1 active:shadow-none active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={() => chooseFeedback('got_it')}
          >
            <span>Got It!</span>
            {#if gotItTime}
              <span class="keycap-primary inline-flex items-center justify-center bg-primary-dark border border-white/20 text-[10px] text-white px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]">{gotItTime}</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
