<script>
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { parseNoteBack } from '$lib/notes';
  import { getSupabaseClient } from '$lib/supabase';
  import { apiFetchAuthed } from '$lib/api';
  import { Confetti } from 'svelte-confetti';

  /** @typedef {{ id: string | number, fields?: string[] }} Note */
  /** @typedef {{ id: string, label: string, value: string }} RevealItem */

  let currentCardData = $state(
    /** @type {{ card_id: number, note: Note, queue?: number, states?: any } | null} */ (null)
  );
  let view = $state('loading'); // loading, question, answer, complete, unauthenticated
  let reviewStats = $state(/** @type {{ timing: any, studied: any } | null} */ (null)); // loaded when queue is empty
  let deckStats = $state({ new_count: 0, learning_count: 0, review_count: 0 });
  let initialDueTotal = $state(/** @type {number | null} */ (null));
  let answerMode = $state(''); // foggy, got_it
  let revealCount = $state(0);
  let latestRevealIndex = $state(-1);
  let easyBurst = $state(false);
  let cardMotion = $state('idle'); // idle, settle, swipe-out, swipe-in
  let advancing = $state(false);
  let isMounted = $state(false);

  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];

  /** @param {() => void} fn @param {number} ms */
  function schedule(fn, ms) {
    const id = setTimeout(() => {
      timers = timers.filter((timerId) => timerId !== id);
      fn();
    }, ms);
    timers = [...timers, id];
    return id;
  }

  function clearAllTimers() {
    for (const id of timers) {
      clearTimeout(id);
    }
    timers = [];
  }

  /** @param {unknown} value */
  function firstNonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  /** @param {unknown} value */
  function firstNonEmptyArrayItem(value) {
    if (!Array.isArray(value)) return '';
    for (const item of value) {
      const text = firstNonEmptyString(item);
      if (text) return text;
    }
    return '';
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

    // booleans
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    // numbers
    if (typeof value === 'number') {
      const k = String(key).toLowerCase();
      // timestamps
      if (k.includes('at') || k.includes('time') || k.includes('timestamp')) {
        // heuristics: ms vs sec
        const ms = value > 2e12 ? value : value > 1e9 ? value * 1000 : null;
        if (ms) return new Date(ms).toLocaleString();
      }
      // durations
      if (k.includes('sec') || k.includes('secs') || k.includes('seconds')) {
        return formatDuration(value);
      }
      if (k.includes('ms') || k.includes('millis')) {
        return formatDuration(value / 1000);
      }
      // percentages
      if (k.includes('pct') || k.includes('percent')) {
        return `${value}%`;
      }
      // plain count
      return value.toLocaleString();
    }

    // strings
    if (typeof value === 'string') {
      const k = String(key).toLowerCase();
      // timestamps as strings ("1700000000", "1700000000000", or ISO)
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

    // arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return '—';
      if (value.length <= 3) return value.map(String).join(', ');
      return `${value.length} items`;
    }

    // objects
    if (typeof value === 'object') {
      try {
        const keys = Object.keys(value);
        if (keys.length === 0) return '—';
        if (keys.length <= 3) {
          return keys
            .map((k) => `${titleizeKey(k)}: ${formatTimingValue(k, value[k])}`)
            .join(' · ');
        }
        return `${keys.length} fields`;
      } catch {
        return '—';
      }
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
    if (k.includes('next')) return 'schedule';
    return 'schedule';
  }

  /** @param {any} state */
  function formatSchedulingTime(state) {
    if (!state) return '';
    const normal = state.normal || state.Normal;
    if (normal) {
      if (normal.learning || normal.Learning) {
        const s =
          (normal.learning || normal.Learning).scheduledSecs ??
          (normal.learning || normal.Learning).scheduled_secs ??
          0;
        return s < 60 ? '<1m' : `${Math.floor(s / 60)}m`;
      }
      if (normal.review || normal.Review) {
        const d =
          (normal.review || normal.Review).scheduledDays ??
          (normal.review || normal.Review).scheduled_days ??
          0;
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
      const s =
        (filtered.preview || filtered.Preview).scheduledSecs ??
        (filtered.preview || filtered.Preview).scheduled_secs ??
        0;
      return s < 60 ? '<1m' : `${Math.floor(s / 60)}m`;
    }
    return '';
  }

  /** @param {Note} note */
  function buildRevealData(note) {
    const rawBack = note?.fields?.[1] || '';
    const parsed = parseNoteBack(rawBack);
    const fallbackDefinition =
      rawBack && typeof rawBack === 'string' && !rawBack.trim().startsWith('{') ? rawBack : '';

    const example = firstNonEmptyArrayItem(parsed.examples);
    const synonym = firstNonEmptyArrayItem(parsed.synonyms);
    const simpleDefinition = firstNonEmptyString(parsed.simple_definition) || fallbackDefinition;
    const translation =
      firstNonEmptyString(parsed.in_chinese) ||
      firstNonEmptyString(parsed.translation) ||
      firstNonEmptyString(note?.fields?.[2]) ||
      'No translation available.';
    const etymology = firstNonEmptyString(parsed.etymology) || firstNonEmptyString(parsed.origins);

    /** @type {RevealItem[]} */
    const items = [];
    if (example) items.push({ id: 'example', label: 'Example', value: example });
    if (synonym) items.push({ id: 'synonym', label: 'Synonym', value: synonym });
    if (simpleDefinition) {
      items.push({ id: 'simple-definition', label: 'Definition', value: simpleDefinition });
    }
    if (translation) items.push({ id: 'translation', label: 'Translation', value: translation });
    if (etymology) items.push({ id: 'etymology', label: 'Etymology', value: etymology });

    return { translation, items };
  }

  function resetCardAnswerState() {
    answerMode = '';
    revealCount = 0;
    latestRevealIndex = -1;
    easyBurst = false;
  }

  async function refreshStats() {
    try {
      const res = await apiFetchAuthed(supabase, '/api/deck/stats');
      if (!res) return;
      const data = await res.json();

      // Check if counts changed to trigger pulse animation
      const changed =
        data.new_count !== deckStats.new_count ||
        data.learning_count !== deckStats.learning_count ||
        data.review_count !== deckStats.review_count;

      deckStats = data;

      if (changed) {
        pulseStats();
      }
    } catch (e) {
      console.error('Failed to refresh stats', e);
    }
  }

  let statsPulsing = $state(false);
  function pulseStats() {
    statsPulsing = true;
    schedule(() => {
      statsPulsing = false;
    }, 600);
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

  /** @param {any} stats */
  function dueRemainingFromStats(stats) {
    if (!stats || typeof stats !== 'object') return 0;
    const learn = Number(stats.learning_count ?? stats.learnCount ?? stats.learn_count ?? 0) || 0;
    const review = Number(stats.review_count ?? stats.reviewCount ?? stats.review_count ?? 0) || 0;
    const newly = Number(stats.new_count ?? stats.newCount ?? stats.new_count ?? 0) || 0;
    return learn + review + newly;
  }

  async function loadNextCard() {
    try {
      // Fetch next card + deck stats together
      const [cardRes, statsRes] = await Promise.all([
        apiFetchAuthed(supabase, '/api/card/next'),
        apiFetchAuthed(supabase, '/api/deck/stats')
      ]);

      const cardData = await cardRes.json();
      const newStats = await statsRes.json().catch(() => ({
        new_count: 0,
        learning_count: 0,
        review_count: 0
      }));

      deckStats = newStats;

      const remaining = dueRemainingFromStats(deckStats);
      if (initialDueTotal === null && remaining > 0) {
        initialDueTotal = remaining;
      } else if (initialDueTotal !== null && remaining > initialDueTotal) {
        // if counts increase (day rollover or sync), keep bar stable
        initialDueTotal = remaining;
      }

      // Protobuf JSON uses camelCase by default (cards, noteId)
      if (cardData.cards && cardData.cards.length > 0) {
        const qcard = cardData.cards[0];
        const card = qcard.card;
        const noteId = card.noteId || card.note_id; // handle camel or snake just in case

        // Fetch the note content for that card
        const noteRes = await apiFetchAuthed(supabase, `/api/note/@${noteId}`);
        const noteData = await noteRes.json();

        currentCardData = {
          card_id: card.id,
          note: noteData,
          queue: qcard.queue,
          states: qcard.states
        };
        view = 'question';
      } else {
        // Empty queue
        currentCardData = null;
        view = 'complete';
        void loadReviewStats();
      }
    } catch (e) {
      console.error(e);
      view = 'complete'; // Fail safe
      void loadReviewStats();
    }
    resetCardAnswerState();
    cardMotion = 'idle';
    advancing = false;
  }

  /** @param {number} index */
  function markFreshReveal(index) {
    latestRevealIndex = index;
    schedule(() => {
      if (latestRevealIndex === index) latestRevealIndex = -1;
    }, 620);
  }

  function pulseNoMoreHints() {
    // No-op for now, hints are exhausted
  }

  onMount(() => {
    supabase = getSupabaseClient();
    isMounted = true;

    /** @param {KeyboardEvent} event */
    const handleKeyDown = (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      const key = event.key;
      if (key === ' ') {
        event.preventDefault();
        if (view === 'question') {
          showFoggyAnswer();
        } else if (view === 'answer' && answerMode === 'foggy') {
          revealMore();
        }
      } else if (key === 'Enter') {
        event.preventDefault();
        if (view === 'question') {
          showGotItAnswer();
        } else if (view === 'answer') {
          nextCard();
        }
      } else if (key === 'ArrowLeft') {
        if (view === 'answer' && answerMode === 'foggy' && revealCount > 1) {
          revealCount -= 1;
        }
      } else if (key === 'ArrowRight') {
        if (view === 'answer' && answerMode === 'foggy' && hasMoreReveal) {
          revealMore();
        }
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

  function showFoggyAnswer() {
    // Answer AGAIN (1) immediately
    apiFetchAuthed(supabase, `/api/card/answer/1`, { method: 'POST' })
      .then(() => refreshStats())
      .catch(console.error);

    answerMode = 'foggy';
    revealCount = revealItems.length > 0 ? 1 : 0;
    if (revealCount > 0) markFreshReveal(0);
    cardMotion = 'settle';
    schedule(() => {
      if (cardMotion === 'settle') cardMotion = 'idle';
    }, 240);
    view = 'answer';
  }

  function showGotItAnswer() {
    // Answer GOOD (3) immediately
    apiFetchAuthed(supabase, `/api/card/answer/3`, { method: 'POST' })
      .then(() => refreshStats())
      .catch(console.error);

    answerMode = 'got_it';
    revealCount = 0;
    latestRevealIndex = -1;
    easyBurst = true;
    cardMotion = 'settle';
    schedule(() => {
      easyBurst = false;
      if (cardMotion === 'settle') cardMotion = 'idle';
    }, 340);
    view = 'answer';
  }

  function revealMore() {
    if (view !== 'answer' || answerMode !== 'foggy') return;
    if (revealCount >= revealItems.length) {
      pulseNoMoreHints();
      return;
    }

    revealCount += 1;
    const freshIndex = revealCount - 1;
    markFreshReveal(freshIndex);
  }

  function nextCard() {
    if (advancing) return;

    advancing = true;
    cardMotion = 'swipe-out';
    schedule(async () => {
      await loadNextCard();

      // If we have a new card, animate in. Otherwise completion view handles itself.
      if (currentCardData) {
        cardMotion = 'swipe-in';
        schedule(() => {
          cardMotion = 'idle';
          advancing = false;
        }, 210);
      } else {
        view = 'complete';
        advancing = false;
      }
    }, 170);
  }

  let currentNote = $derived(currentCardData?.note || { id: -1, fields: [] });
  let revealData = $derived(buildRevealData(currentNote));

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
  let revealItems = $derived(revealData.items);
  let currentHint = $derived(revealItems[revealCount - 1]);
  let nextHintLabel = $derived(revealItems[revealCount]?.label);
  let afterNextHintLabel = $derived(revealItems[revealCount + 1]?.label);
  let hasMoreReveal = $derived(revealCount < revealItems.length);
  let progress = $derived.by(() => {
    const total = initialDueTotal ?? 0;
    if (!total) return 0;
    const remaining = dueRemainingFromStats(deckStats);
    const done = Math.max(0, Math.min(total, total - remaining));
    return (done / total) * 100;
  });

  // Swipe detection
  let touchStartX = 0;
  let touchEndX = 0;

  /** @param {TouchEvent} e */
  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
  }

  /** @param {TouchEvent} e */
  function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }

  function handleSwipe() {
    const diff = touchEndX - touchStartX;
    const threshold = 50;

    if (Math.abs(diff) < threshold) return;

    if (diff > 0) {
      // Swipe Right -> Next Hint (as requested)
      if (hasMoreReveal) revealMore();
    } else {
      // Swipe Left -> Previous Hint (as requested)
      if (revealCount > 1) revealCount -= 1;
    }
  }
</script>

{#if view === 'loading'}
  <div
    class="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark"
  >
    <div
      class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
    ></div>
  </div>
{:else if view === 'complete'}
  <div
    class="bg-white dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-300 relative overflow-hidden"
  >
    <main class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
      <div
        class="w-full max-w-[640px] flex flex-col items-center text-center gap-8 animate-in fade-in slide-in-from-bottom-12 duration-700 ease-out-expo"
      >
        <div class="relative mb-2">
          <div class="relative w-40 h-40 mx-auto z-20 text-6xl flex items-center justify-center">
            ✅
          </div>
        </div>
        <div class="space-y-2">
          <h1 class="text-4xl md:text-5xl font-bold text-primary tracking-tight">All caught up</h1>
          <p class="text-xl text-gray-500 dark:text-gray-400 font-medium">
            No cards due right now.
          </p>
        </div>

        <div class="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div
            class="bg-white dark:bg-card-dark rounded-3xl p-6 border-2 border-gray-100 dark:border-[#333333] text-left shadow-sm hover:border-primary transition-all hover:scale-[1.02] duration-300"
          >
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              Total Progress
            </p>
            <p class="mt-2 text-2xl font-black text-slate-800 dark:text-white">
              {reviewStats?.studied?.msg ?? 'Completed!'}
            </p>
          </div>

          <div
            class="bg-white dark:bg-card-dark rounded-3xl p-6 border-2 border-gray-100 dark:border-[#333333] text-left shadow-sm hover:border-primary transition-all hover:scale-[1.02] duration-300"
          >
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              Session Review
            </p>

            {#if timingItems.length > 0}
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {#each timingItems as item (item.key)}
                  <div
                    class="rounded-2xl bg-slate-50 dark:bg-[#252525] px-3 py-2 border border-slate-200 dark:border-gray-700 hover:bg-white dark:hover:bg-midnight-navy transition-colors"
                  >
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[16px] text-primary"
                        >{item.icon}</span
                      >
                      <p class="text-[9px] font-black uppercase tracking-wider text-slate-400">
                        {item.label}
                      </p>
                    </div>
                    <p
                      class="mt-1 text-sm font-black text-slate-700 dark:text-slate-200 break-words"
                    >
                      {item.valueText}
                    </p>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="mt-2 text-sm text-slate-500 dark:text-slate-400 font-bold italic">
                — Session Stats Finalized —
              </p>
            {/if}
          </div>
        </div>
      </div>
    </main>

    <footer
      class="w-full bg-white/50 dark:bg-background-dark/50 backdrop-blur-md border-t-2 border-gray-100 dark:border-[#2A2A2A] p-8 z-20"
    >
      <div class="max-w-[1024px] mx-auto">
        <a
          href={resolve('/')}
          class="block w-full text-center bg-primary text-white rounded-2xl text-xl font-black uppercase tracking-[0.2em] py-5 shadow-[0_6px_0_0_#cc7000] hover:bg-[#ff9a24] hover:brightness-110 active:translate-y-1 active:shadow-none active:scale-[0.99] transition-all cursor-pointer"
        >
          Return to Dashboard
        </a>
      </div>
    </footer>
  </div>
{:else if view === 'unauthenticated'}
  <div class="min-h-screen flex items-center justify-center px-6">
    <div class="text-center space-y-4">
      <h1 class="text-2xl font-fredoka font-bold text-slate-800 dark:text-white">
        Sign in required
      </h1>
      <p class="text-slate-500 dark:text-slate-400">Please sign in to start practice.</p>
      <a
        href={resolve('/')}
        class="inline-block px-5 py-2.5 rounded-xl bg-primary text-white font-bold uppercase tracking-wider text-sm shadow-sm hover:brightness-105 transition-all"
      >
        Go to Login
      </a>
    </div>
  </div>
{:else}
  <div
    class="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-300"
  >
    <header
      class="w-full max-w-[1024px] mx-auto px-6 py-8 flex items-center gap-6"
      class:animate-entrance={isMounted}
      style="--entrance-delay: 0s;"
    >
      <a
        href={resolve('/')}
        class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 active:scale-90 transition-transform"
      >
        <span class="material-symbols-outlined text-3xl font-bold">close</span>
      </a>
      <div
        class="flex-1 h-4 bg-gray-200 dark:bg-[#2A2A2A] rounded-full overflow-hidden shadow-inner"
      >
        <div
          class="h-full bg-primary rounded-full relative transition-all duration-500 ease-out-expo"
          style="width: {progress}%;"
        >
          <div class="absolute top-1 left-1 right-1 h-1 bg-white/20 rounded-full"></div>
        </div>
      </div>
      <div
        class="flex items-center gap-3 sm:gap-4 font-fredoka transition-all duration-300"
        class:stats-pulse={statsPulsing}
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

    <main class="flex-1 flex flex-col items-center justify-start px-6 pb-24 pt-4 sm:pt-12">
      <div
        class="w-full max-w-[550px] flex flex-col gap-8 sm:gap-8 transition-transform duration-300 ease-in-out will-change-transform"
        style="transform: translateY({view === 'question' ? '5vh' : '0'});"
      >
        <!-- Word Card -->
        <div
          class="practice-card w-full bg-white dark:bg-card-dark rounded-2xl flex flex-col items-center justify-center text-center shadow-[0_8px_0_0_#e5e7eb] dark:shadow-[0_8px_0_0_#1a1a1a] border-2 border-gray-100 dark:border-[#333333] p-8 sm:p-12 min-h-[160px] origin-top transition-all duration-300 ease-out-expo will-change-transform"
          class:practice-card--swipe-out={cardMotion === 'swipe-out'}
          class:practice-card--swipe-in={cardMotion === 'swipe-in'}
          class:no-transition={cardMotion === 'swipe-in' || cardMotion === 'swipe-out'}
          class:animate-entrance={isMounted}
          style="--entrance-delay: 0.1s;"
        >
          <h1 class="font-bold text-gray-900 dark:text-white leading-tight">
            <span class="inline-block origin-top text-4xl sm:text-5xl tracking-tight">
              {currentNote.fields?.[0]}
            </span>
          </h1>
        </div>

        <!-- Hint Stack -->
        {#if view === 'answer'}
          <div
            class="relative w-full mb-8 sm:mb-12 h-[320px] animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out-expo touch-pan-y"
            class:practice-card--swipe-out={cardMotion === 'swipe-out'}
            class:practice-card--swipe-in={cardMotion === 'swipe-in'}
            class:no-transition={cardMotion === 'swipe-in' || cardMotion === 'swipe-out'}
            ontouchstart={handleTouchStart}
            ontouchend={handleTouchEnd}
            role="region"
            aria-label="Card Swipe Area"
          >
            {#if answerMode === 'foggy'}
              <!-- Background cards for stack effect -->
              {#if afterNextHintLabel}
                <div
                  class="absolute inset-0 w-full bg-white dark:bg-card-dark rounded-2xl border-2 border-gray-100 dark:border-[#333333] shadow-sm stack-card-3 flex items-start justify-center pt-2"
                >
                  <span
                    class="text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-[0.2em]"
                    >{afterNextHintLabel}</span
                  >
                </div>
              {/if}
              {#if nextHintLabel}
                <div
                  class="absolute inset-0 w-full bg-white dark:bg-card-dark rounded-2xl border-2 border-gray-100 dark:border-[#333333] shadow-sm stack-card-2 flex items-start justify-center pt-2"
                >
                  <span
                    class="text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-[0.2em]"
                    >{nextHintLabel}</span
                  >
                </div>
              {/if}

              <!-- Top Card -->
              <div
                class="relative w-full bg-white dark:bg-card-dark rounded-2xl border-2 border-gray-100 dark:border-[#333333] shadow-md stack-card-1 p-8 min-h-[320px] transition-all duration-300 ease-out-expo"
                class:practice-card--settle={cardMotion === 'settle'}
              >
                {#if currentHint}
                  <div class="flex justify-center mb-6">
                    <span
                      class="px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-[0.2em] animate-in zoom-in-90 duration-300"
                      >{currentHint.label}</span
                    >
                  </div>
                  <div class="space-y-6">
                    <p
                      class="text-gray-700 dark:text-gray-300 leading-relaxed text-xl font-medium text-center animate-in fade-in slide-in-from-top-4 duration-500 delay-150"
                    >
                      {currentHint.value}
                    </p>
                  </div>
                {:else}
                  <div class="flex items-center justify-center h-full">
                    <p class="text-gray-400 italic">Thinking...</p>
                  </div>
                {/if}
              </div>
            {:else if answerMode === 'got_it'}
              <div
                class="relative w-full bg-white dark:bg-card-dark rounded-2xl border-2 border-primary/30 dark:border-primary/20 shadow-xl shadow-primary/5 p-10 flex flex-col items-center justify-center text-center min-h-[320px] animate-in fade-in zoom-in-95 duration-500 ease-out-expo"
              >
                <div class="flex justify-center mb-4">
                  <span
                    class="px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-[0.2em]"
                    >Translation</span
                  >
                </div>
                <div class="inline-flex mx-auto mb-4 text-primary" class:easy-burst={easyBurst}>
                  <span class="material-symbols-outlined text-6xl fill-1">check_circle</span>
                </div>
                <p class="text-4xl text-primary font-black mt-2 tracking-tight">
                  {revealData.translation}
                </p>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Mascot / Message -->
        <div
          class="flex items-center gap-4 w-full"
          class:animate-entrance={isMounted}
          style="--entrance-delay: 0.2s;"
        >
          <div class="relative shrink-0 group">
            <div
              class="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-4 border-white dark:border-card-dark shadow-sm group-hover:scale-110 transition-transform duration-500 ease-out-expo"
            >
              <div
                class="relative w-full h-full bg-center bg-no-repeat bg-cover"
                style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAHtbiRDueIDF5dG93OSJIyZKuRIRLlcyxXs6AUZMiU-9aGsAiT0cmyilThWjVnUd8HncuM6tyVQo0HLzla2MLZObHjhQG_-ks2RTmKJdTD0rZeIA5UwJc9x5oGzePsCsuVNFqZipOpeh8c3WeA8hU7qWDmD-p7HYBMr5wbrhjlW-NSPv9a-BNsFgsjJE16Y9R8FB_TcoOWt13bC-mz8kZuaxF2rqTbWIjwFQNVjsse8J7VtVwpyLBaBXTlA9tNt4Ik7tcAzGjO7xU');"
              ></div>
            </div>
          </div>
          <div
            class="flex-1 bg-white dark:bg-card-dark p-5 rounded-3xl rounded-bl-none border-2 border-gray-100 dark:border-[#333333] shadow-sm relative transition-all duration-300"
          >
            <p class="text-gray-600 dark:text-gray-300 font-medium leading-snug">
              {#if view === 'question'}
                Try to recall the meaning before looking at hints!
              {:else if answerMode === 'got_it'}
                Spot on! You really know your stuff.
              {:else}
                Each hint gets closer to the answer.
              {/if}
            </p>
            <div
              class="absolute -left-2 bottom-0 w-4 h-4 bg-white dark:bg-card-dark border-l-2 border-b-2 border-gray-100 dark:border-[#333333] transform rotate-45 -translate-x-1/2"
            ></div>
          </div>
        </div>
      </div>
    </main>

    <footer
      class="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-t-2 border-gray-100 dark:border-[#2A2A2A] p-4 z-50 transition-all duration-500"
      class:animate-entrance={isMounted}
      style="--entrance-delay: 0.3s;"
    >
      <div
        class="max-w-[1024px] mx-auto flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-8"
      >
        {#if view === 'question'}
          <button
            onclick={showFoggyAnswer}
            class="w-full md:w-64 h-14 bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-[#333333] text-gray-500 dark:text-gray-300 rounded-2xl text-base font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_4px_0_0_#e5e7eb] dark:shadow-[0_4px_0_0_#1a1a1a] hover:bg-slate-50 active:translate-y-1 active:shadow-none transition-all cursor-pointer"
          >
            <span>Foggy</span>
            <span
              class="keycap hidden sm:inline-flex items-center justify-center bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-gray-700 text-[10px] text-gray-400 px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]"
            >
              {formatSchedulingTime(currentCardData?.states?.again)}
            </span>
          </button>
          <button
            onclick={showGotItAnswer}
            class="w-full md:w-64 h-14 bg-primary text-white rounded-2xl text-base font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_4px_0_0_#cc7000] hover:bg-[#ff9a24] hover:brightness-105 active:translate-y-1 active:shadow-none active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Got It!</span>
            <span
              class="keycap-orange hidden sm:inline-flex items-center justify-center bg-primary-dark border border-white/20 text-[10px] text-white px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]"
            >
              {formatSchedulingTime(currentCardData?.states?.good)}
            </span>
          </button>
        {:else}
          <button
            onclick={revealMore}
            disabled={!hasMoreReveal || answerMode === 'got_it'}
            class="w-full md:w-64 h-14 bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-[#333333] text-gray-500 dark:text-gray-300 rounded-2xl text-base font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_4px_0_0_#e5e7eb] dark:shadow-[0_4px_0_0_#1a1a1a] hover:bg-slate-50 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Next Hint</span>
            <span
              class="keycap hidden sm:inline-flex items-center justify-center bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-gray-700 text-[10px] text-gray-400 px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]"
            >
              SPACE
            </span>
          </button>
          <button
            onclick={nextCard}
            class="w-full md:w-64 h-14 bg-primary text-white rounded-2xl text-base font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_4px_0_0_#cc7000] hover:bg-[#ff9a24] hover:brightness-105 active:translate-y-1 active:shadow-none active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Continue</span>
            <span
              class="keycap-orange hidden sm:inline-flex items-center justify-center bg-primary-dark border border-white/20 text-[10px] text-white px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]"
            >
              ENTER
            </span>
          </button>
        {/if}
      </div>
    </footer>
  </div>
{/if}

<style>
  :root {
    --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  }

  .ease-out-expo {
    transition-timing-function: var(--ease-out-expo);
  }

  /* Entrance Animations */
  .animate-entrance {
    animation: entrance 0.8s var(--ease-out-expo) backwards;
    animation-delay: var(--entrance-delay, 0s);
  }

  @keyframes entrance {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Stats Pulse */
  .stats-pulse {
    animation: statsPulse 0.6s var(--ease-out-expo);
  }

  @keyframes statsPulse {
    0% {
      transform: scale(1);
    }
    30% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }

  .practice-card {
    contain: layout paint;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .practice-card--swipe-out {
    animation: cardSwipeOut 0.25s var(--ease-out-quint) forwards;
    will-change: transform, opacity;
  }

  .practice-card--swipe-in {
    animation: cardSwipeIn 0.35s var(--ease-out-expo);
    will-change: transform, opacity;
  }

  .no-transition {
    transition: none !important;
  }

  .stack-card-1 {
    z-index: 30;
    transform: translateY(0);
  }
  .stack-card-2 {
    z-index: 20;
    transform: translateY(12px) scale(0.97);
  }
  .stack-card-3 {
    z-index: 10;
    transform: translateY(24px) scale(0.94);
  }

  .keycap {
    box-shadow: 0 2px 0px 0px #d1d5db;
  }
  :global(.dark) .keycap {
    box-shadow: 0 2px 0px 0px #1a1a1a;
  }
  .keycap-orange {
    box-shadow: 0 2px 0px 0px #cc7000;
  }

  .practice-card--settle {
    animation: cardSettle 0.3s var(--ease-out-expo);
    will-change: transform;
  }

  .easy-burst {
    animation: easyPop 0.4s var(--ease-out-expo);
    will-change: transform, opacity;
  }

  @keyframes cardSettle {
    0% {
      transform: translateY(12px) scale(0.96);
    }
    100% {
      transform: translateY(0) scale(1);
    }
  }

  @keyframes cardSwipeOut {
    0% {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
    100% {
      transform: translateX(40px) scale(0.95);
      opacity: 0;
    }
  }

  @keyframes cardSwipeIn {
    0% {
      transform: translateX(-40px) scale(0.95);
      opacity: 0;
    }
    100% {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
  }

  @keyframes easyPop {
    0% {
      transform: scale(0.6);
      opacity: 0;
    }
    60% {
      transform: scale(1.15);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
