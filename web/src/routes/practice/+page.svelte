<script>
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { Confetti } from 'svelte-confetti';
  import { fetchNotes, parseNoteBack } from '$lib/notes';
  import { getSupabaseClient } from '$lib/supabase';

  /** @typedef {{ id: string | number, fields?: string[] }} Note */
  /** @typedef {{ id: string, label: string, value: string }} RevealItem */

  /** @type {Note[]} */
  let notes = $state([]);
  let currentIndex = $state(0);
  let view = $state('loading'); // loading, question, answer, complete, unauthenticated
  let answerMode = $state(''); // not_sure, easy
  let revealCount = $state(0);
  let latestRevealIndex = $state(-1);
  let moreKeyFlash = $state(false);
  let moreNudge = $state(false);
  let moreLockPulse = $state(false);
  let easyBurst = $state(false);
  let cardMotion = $state('idle'); // idle, settle, swipe-out, swipe-in
  let advancing = $state(false);
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
      items.push({ id: 'simple-definition', label: 'Simple Definition', value: simpleDefinition });
    }
    if (translation) items.push({ id: 'translation', label: 'Translation', value: translation });
    if (etymology) items.push({ id: 'etymology', label: 'Etymology', value: etymology });

    return { translation, items };
  }

  function resetCardAnswerState() {
    answerMode = '';
    revealCount = 0;
    latestRevealIndex = -1;
    moreKeyFlash = false;
    moreNudge = false;
    moreLockPulse = false;
    easyBurst = false;
  }

  async function loadNotes() {
    try {
      notes = await fetchNotes(supabase);
      currentIndex = 0;
      resetCardAnswerState();
      cardMotion = 'idle';
      advancing = false;
      if (notes.length > 0) {
        view = 'question';
      } else {
        view = 'complete';
      }
    } catch (e) {
      console.error(e);
    }
  }

  /** @param {number} index */
  function markFreshReveal(index) {
    latestRevealIndex = index;
    schedule(() => {
      if (latestRevealIndex === index) latestRevealIndex = -1;
    }, 620);
  }

  function pulseNoMoreHints() {
    moreNudge = true;
    schedule(() => {
      moreNudge = false;
    }, 240);
  }

  onMount(() => {
    supabase = getSupabaseClient();

    /** @param {KeyboardEvent} event */
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() !== 'm') return;
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
      if (view === 'answer' && answerMode === 'not_sure') {
        moreKeyFlash = true;
        schedule(() => {
          moreKeyFlash = false;
        }, 180);
      }
      revealMore();
    };

    window.addEventListener('keydown', handleKeyDown);

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await loadNotes();
      } else {
        view = 'unauthenticated';
      }
    })();

    return () => {
      clearAllTimers();
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  function showNotSureAnswer() {
    answerMode = 'not_sure';
    revealCount = revealItems.length > 0 ? 1 : 0;
    if (revealCount > 0) markFreshReveal(0);
    cardMotion = 'settle';
    schedule(() => {
      if (cardMotion === 'settle') cardMotion = 'idle';
    }, 240);
    view = 'answer';
  }

  function showEasyAnswer() {
    answerMode = 'easy';
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
    if (view !== 'answer' || answerMode !== 'not_sure') return;
    if (revealCount >= revealItems.length) {
      pulseNoMoreHints();
      return;
    }

    revealCount += 1;
    const freshIndex = revealCount - 1;
    markFreshReveal(freshIndex);

    if (revealCount >= revealItems.length) {
      moreLockPulse = true;
      schedule(() => {
        moreLockPulse = false;
      }, 300);
    }
  }

  function nextCard() {
    if (advancing) return;
    if (currentIndex >= notes.length - 1) {
      view = 'complete';
      return;
    }

    advancing = true;
    cardMotion = 'swipe-out';
    schedule(() => {
      currentIndex++;
      resetCardAnswerState();
      view = 'question';
      cardMotion = 'swipe-in';

      schedule(() => {
        cardMotion = 'idle';
        advancing = false;
      }, 210);
    }, 170);
  }

  let currentNote = $derived(notes[currentIndex] || {});
  let revealData = $derived(buildRevealData(currentNote));
  let revealItems = $derived(revealData.items);
  let visibleRevealItems = $derived(revealItems.slice(0, revealCount));
  let hasMoreReveal = $derived(revealCount < revealItems.length);
  let revealProgressPct = $derived(
    revealItems.length > 0 ? (revealCount / revealItems.length) * 100 : 100
  );
  let revealProgressText = $derived(
    `${Math.min(revealCount, revealItems.length)}/${revealItems.length}`
  );
  let progress = $derived(notes.length > 0 ? (currentIndex / notes.length) * 100 : 0);
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
    <div class="confetti-layer pointer-events-none" aria-hidden="true">
      <!--
        delay -1000 to cancel the initial launch delay and `top: -20px`
        to hide the initial horizontal spreading process
      -->
      <Confetti
        amount={320}
        size={12}
        duration={5200}
        delay={[-1000, 2000]}
        y={[0, 0.1]}
        x={[-5, 5]}
        fallDistance="135vh"
        colorArray={['#F48C25', '#FFB347', '#38BDF8', '#22C55E', '#F43F5E', '#FDE047']}
        disableForReducedMotion={true}
      />
    </div>
    <div
      class="absolute inset-0 pattern-bg pointer-events-none opacity-10"
      style="background-image: radial-gradient(#f48c25 0.5px, transparent 0.5px); background-size: 40px 40px;"
    ></div>
    <main class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
      <div class="w-full max-w-[600px] flex flex-col items-center text-center gap-8">
        <div class="relative mb-4">
          <div class="relative w-48 h-48 mx-auto z-20">
            <div
              class="w-full h-full bg-center bg-no-repeat bg-contain flex items-center justify-center text-6xl"
            >
              🎉
            </div>
          </div>
        </div>
        <div class="space-y-2">
          <h1 class="text-4xl md:text-5xl font-bold text-primary tracking-tight">
            Session Complete!
          </h1>
          <p class="text-xl text-gray-500 dark:text-gray-400 font-medium">
            You're making great progress!
          </p>
        </div>
        <div class="w-full flex flex-col md:flex-row gap-4 mt-4">
          <div
            class="flex-1 bg-white dark:bg-card-dark rounded-2xl p-6 border-2 border-gray-100 dark:border-[#333333] flex flex-col items-center justify-center gap-3"
          >
            <div class="text-center">
              <p class="text-xs font-bold uppercase tracking-wider text-gray-400">Cards</p>
              <p class="text-lg font-bold text-gray-800 dark:text-white">{notes.length}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
    <footer
      class="w-full bg-white dark:bg-background-dark border-t-2 border-gray-100 dark:border-[#2A2A2A] p-6 z-20"
    >
      <div class="max-w-[1024px] mx-auto">
        <a
          href={resolve('/')}
          class="block w-full text-center bg-primary text-white rounded-2xl text-lg font-bold uppercase tracking-widest py-3.5 shadow-[0_4px_0_0_#cc7000] hover:bg-[#ff9a24] transition-all active:translate-y-1 active:shadow-none cursor-pointer"
        >
          Continue
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
        class="inline-block px-5 py-2.5 rounded-xl bg-primary text-white font-bold uppercase tracking-wider text-sm"
      >
        Go to Login
      </a>
    </div>
  </div>
{:else}
  <div
    class="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-300"
  >
    <header class="w-full max-w-[1024px] mx-auto px-6 py-8 flex items-center gap-6">
      <a href={resolve('/')} class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <span class="material-symbols-outlined text-3xl font-bold">close</span>
      </a>
      <div class="flex-1 h-4 bg-gray-200 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
        <div
          class="h-full bg-primary rounded-full relative transition-all duration-300"
          style="width: {progress}%;"
        >
          <div class="absolute top-1 left-1 right-1 h-1 bg-white/20 rounded-full"></div>
        </div>
      </div>
      <div class="flex items-center gap-2 text-primary">
        <span class="material-symbols-outlined font-bold" style="font-variation-settings: 'FILL' 1"
          >favorite</span
        >
        <span class="text-xl font-bold">5</span>
      </div>
    </header>

    <main class="flex-1 flex flex-col items-center justify-center px-6 pb-32">
      <div class="w-full max-w-[600px] flex flex-col items-center gap-10">
        {#if view === 'question'}
          <div class="w-full text-left">
            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-300">
              Do you know this word?
            </h2>
          </div>
        {/if}

        <div
          class="practice-card w-full bg-white dark:bg-card-dark rounded-[2rem] p-16 flex flex-col items-center justify-center text-center shadow-[0_8px_0_0_#e5e7eb] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border-2 border-gray-100 dark:border-[#333333]"
          class:practice-card--settle={cardMotion === 'settle'}
          class:practice-card--swipe-out={cardMotion === 'swipe-out'}
          class:practice-card--swipe-in={cardMotion === 'swipe-in'}
        >
          <h1 class="text-6xl md:text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {currentNote.fields?.[0]}
          </h1>

          {#if view === 'answer'}
            {#if answerMode === 'easy'}
              <div
                class="w-full max-w-[520px] flex flex-col gap-2 animate-in fade-in zoom-in duration-300"
              >
                <span
                  class="px-5 py-1.5 bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-400 rounded-full text-sm font-semibold uppercase tracking-wider mx-auto"
                  >Translation</span
                >
                <div class="inline-flex mx-auto mb-1 text-primary" class:easy-burst={easyBurst}>
                  <span class="material-symbols-outlined text-4xl fill-1">check_circle</span>
                </div>
                <p class="text-3xl text-primary font-display font-bold mt-2">
                  {revealData.translation}
                </p>
              </div>
            {:else}
              <div
                class="w-full max-w-[520px] flex flex-col gap-3 animate-in fade-in zoom-in duration-300"
              >
                {#if visibleRevealItems.length === 0}
                  <p class="text-gray-500 dark:text-gray-400">No additional details available.</p>
                {:else}
                  {#each visibleRevealItems as item, i (item.id)}
                    <div
                      class="reveal-card rounded-2xl border border-gray-200 dark:border-[#333333] px-5 py-4 text-left dark:bg-[#1A1A1A]"
                      class:reveal-card--past={i < visibleRevealItems.length - 1}
                      class:reveal-card--latest={i === visibleRevealItems.length - 1}
                      class:reveal-card--fresh={i === latestRevealIndex}
                    >
                      <p
                        class="reveal-card-label text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1"
                      >
                        {item.label}
                      </p>
                      <p
                        class="reveal-card-value text-xl text-gray-800 dark:text-white font-medium"
                      >
                        {item.value}
                      </p>
                    </div>
                  {/each}
                {/if}
                <div class="flex justify-center pt-2">
                  <button
                    onclick={revealMore}
                    disabled={!hasMoreReveal}
                    class="more-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-[#333333] text-sm font-bold text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-card-dark"
                    class:more-btn--keyflash={moreKeyFlash}
                    class:more-btn--nudge={moreNudge}
                    class:more-btn--lockpulse={moreLockPulse}
                  >
                    <span
                      class="progress-ring"
                      style={`background: conic-gradient(#ff8c00 ${revealProgressPct}%, rgba(148, 163, 184, 0.2) 0%);`}
                    >
                      <span class="progress-ring-inner"></span>
                    </span>
                    <span class="material-symbols-outlined text-base"
                      >{hasMoreReveal ? 'more_horiz' : 'lock'}</span
                    >
                    {hasMoreReveal ? `More (${revealProgressText})` : 'All hints shown'}
                    <span class="text-[10px] opacity-70 ml-1">M</span>
                  </button>
                </div>
              </div>
            {/if}
          {:else}
            <div class="flex flex-col gap-3">
              <p class="text-xl text-gray-500 dark:text-gray-400 font-medium">...</p>
            </div>
          {/if}
        </div>
      </div>
    </main>

    <footer
      class="fixed bottom-0 left-0 right-0 bg-white dark:bg-background-dark border-t-2 border-gray-100 dark:border-[#2A2A2A] p-6 z-10"
    >
      <div class="max-w-[1024px] mx-auto flex gap-4 md:gap-6">
        {#if view === 'question'}
          <button
            onclick={showNotSureAnswer}
            class="flex-1 h-16 bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-[#333333] text-gray-500 dark:text-gray-300 rounded-2xl text-lg font-bold uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-[#252525] transition-all shadow-[0_4px_0_0_#e5e7eb] dark:shadow-[0_4px_0_0_#333333] active:translate-y-1 active:shadow-none cursor-pointer"
          >
            Not Sure
          </button>
          <button
            onclick={showEasyAnswer}
            class="flex-1 h-16 bg-primary text-white rounded-2xl text-lg font-bold uppercase tracking-wide shadow-[0_4px_0_0_#cc7000] hover:bg-[#ff9a24] transition-all active:translate-y-1 active:shadow-none cursor-pointer"
          >
            Easy
          </button>
        {:else}
          <button
            onclick={nextCard}
            class="w-full h-16 bg-primary text-white rounded-2xl text-lg font-bold uppercase tracking-wide shadow-[0_4px_0_0_#cc7000] hover:bg-[#ff9a24] transition-all active:translate-y-1 active:shadow-none cursor-pointer"
          >
            Continue
          </button>
        {/if}
      </div>
    </footer>
  </div>
{/if}

<style>
  .confetti-layer {
    position: fixed;
    top: -20px;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    z-index: 40;
    overflow: hidden;
  }
  .practice-card {
    will-change: transform, opacity;
  }
  .practice-card--settle {
    animation: cardSettle 220ms ease-out;
  }
  .practice-card--swipe-out {
    animation: cardSwipeOut 170ms ease-in forwards;
  }
  .practice-card--swipe-in {
    animation: cardSwipeIn 210ms ease-out;
  }
  .reveal-card {
    transition:
      transform 180ms ease,
      opacity 180ms ease,
      box-shadow 220ms ease;
  }
  .reveal-card--past {
    opacity: 0.78;
    transform: scale(0.985);
  }
  .reveal-card--past .reveal-card-label {
    font-size: 9px;
  }
  .reveal-card--past .reveal-card-value {
    font-size: 0.95rem;
  }
  .reveal-card--latest {
    transform: scale(1);
    opacity: 1;
  }
  .reveal-card--fresh {
    box-shadow:
      0 0 0 2px rgba(255, 140, 0, 0.35),
      0 0 0 8px rgba(255, 140, 0, 0.12);
  }
  .more-btn {
    transition:
      transform 140ms ease,
      box-shadow 180ms ease,
      background-color 180ms ease;
  }
  .more-btn--keyflash {
    box-shadow: 0 0 0 3px rgba(255, 140, 0, 0.25);
  }
  .more-btn--nudge {
    animation: moreNudge 220ms ease;
  }
  .more-btn--lockpulse {
    animation: lockPulse 300ms ease;
  }
  .progress-ring {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .progress-ring-inner {
    width: 0.58rem;
    height: 0.58rem;
    border-radius: 9999px;
    background: white;
  }
  :global(.dark) .progress-ring-inner {
    background: #1e1e1e;
  }
  .easy-burst {
    animation: easyPop 320ms ease-out;
  }
  @keyframes cardSettle {
    0% {
      transform: scale(1.02);
    }
    40% {
      transform: scale(0.985);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes cardSwipeOut {
    0% {
      transform: translateX(0);
      opacity: 1;
    }
    100% {
      transform: translateX(28px);
      opacity: 0;
    }
  }
  @keyframes cardSwipeIn {
    0% {
      transform: translateX(-28px);
      opacity: 0;
    }
    100% {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes moreNudge {
    0% {
      transform: translateX(0);
    }
    30% {
      transform: translateX(-2px);
    }
    70% {
      transform: translateX(2px);
    }
    100% {
      transform: translateX(0);
    }
  }
  @keyframes lockPulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.04);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes easyPop {
    0% {
      transform: scale(0.7);
      opacity: 0;
    }
    70% {
      transform: scale(1.12);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
