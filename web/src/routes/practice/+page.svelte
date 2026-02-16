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
    // No-op for now, hints are exhausted
  }

  onMount(() => {
    supabase = getSupabaseClient();

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
          showNotSureAnswer();
        } else if (view === 'answer' && answerMode === 'not_sure') {
          revealMore();
        }
      } else if (key === 'Enter') {
        event.preventDefault();
        if (view === 'question') {
          showEasyAnswer();
        } else if (view === 'answer') {
          nextCard();
        }
      } else if (key === 'ArrowLeft') {
        if (view === 'answer' && answerMode === 'not_sure' && revealCount > 1) {
          revealCount -= 1;
        }
      } else if (key === 'ArrowRight') {
        if (view === 'answer' && answerMode === 'not_sure' && hasMoreReveal) {
          revealMore();
        }
      }
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
  let currentHint = $derived(revealItems[revealCount - 1]);
  let nextHintLabel = $derived(revealItems[revealCount]?.label);
  let afterNextHintLabel = $derived(revealItems[revealCount + 1]?.label);
  let hasMoreReveal = $derived(revealCount < revealItems.length);
  let progress = $derived(notes.length > 0 ? (currentIndex / notes.length) * 100 : 0);

  // Swipe detection
  let touchStartX = 0;
  let touchEndX = 0;

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
  }

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
    <div class="confetti-layer pointer-events-none" aria-hidden="true">
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
    <main class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
      <div class="w-full max-w-[600px] flex flex-col items-center text-center gap-8">
        <div class="relative mb-4">
          <div class="relative w-48 h-48 mx-auto z-20 text-6xl flex items-center justify-center">
            🎉
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

    <main class="flex-1 flex flex-col items-center justify-start px-6 pb-24 pt-4 sm:pt-12">
      <div
        class="w-full max-w-[550px] flex flex-col gap-8 sm:gap-8 transition-all duration-700 ease-in-out"
        style="margin-top: {view === 'question' ? '5vh' : '0'};"
      >
        <!-- Word Card -->
        <div
          class="w-full bg-white dark:bg-card-dark rounded-2xl flex flex-col items-center text-center shadow-[0_8px_0_0_#e5e7eb] dark:shadow-[0_8px_0_0_#1a1a1a] border-2 border-gray-100 dark:border-[#333333] transition-all duration-700 ease-in-out"
          class:p-8={view === 'question'}
          class:sm:p-12={view === 'question'}
          class:p-6={view === 'answer'}
          class:practice-card--swipe-out={cardMotion === 'swipe-out'}
          class:practice-card--swipe-in={cardMotion === 'swipe-in'}
          class:no-transition={cardMotion === 'swipe-in' || cardMotion === 'swipe-out'}
        >
          <h1
            class="font-bold text-gray-900 dark:text-white transition-all duration-700 ease-in-out"
            class:no-transition={cardMotion === 'swipe-in' || cardMotion === 'swipe-out'}
            style="font-size: {view === 'question' ? '1.5rem' : '1.25rem'}; line-height: {view ===
            'question'
              ? '2rem'
              : '1.75rem'};"
          >
            {currentNote.fields?.[0]}
          </h1>
        </div>

        <!-- Hint Stack -->
        {#if view === 'answer'}
          <div
            class="relative w-full mb-8 sm:mb-12 h-[320px] animate-in fade-in slide-in-from-bottom-12 duration-700 ease-out touch-pan-y"
            ontouchstart={handleTouchStart}
            ontouchend={handleTouchEnd}
          >
            {#if answerMode === 'not_sure'}
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
                class="relative w-full bg-white dark:bg-card-dark rounded-2xl border-2 border-gray-100 dark:border-[#333333] shadow-md stack-card-1 p-8 min-h-[320px] transition-all duration-300"
                class:practice-card--settle={cardMotion === 'settle'}
              >
                {#if currentHint}
                  <div class="flex justify-center mb-6">
                    <span
                      class="px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-[0.2em]"
                      >{currentHint.label}</span
                    >
                  </div>
                  <div class="space-y-6">
                    <p
                      class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg font-medium text-center"
                    >
                      {currentHint.value}
                    </p>
                  </div>
                {:else}
                  <div class="flex items-center justify-center h-full">
                    <p class="text-gray-400">No hints available.</p>
                  </div>
                {/if}
              </div>
            {:else if answerMode === 'easy'}
              <div
                class="relative w-full bg-white dark:bg-card-dark rounded-2xl border-2 border-gray-100 dark:border-[#333333] shadow-md p-10 flex flex-col items-center justify-center text-center min-h-[320px] animate-in fade-in zoom-in duration-300"
              >
                <div class="flex justify-center mb-4">
                  <span
                    class="px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-[0.2em]"
                    >Translation</span
                  >
                </div>
                <div class="inline-flex mx-auto mb-2 text-primary" class:easy-burst={easyBurst}>
                  <span class="material-symbols-outlined text-5xl fill-1">check_circle</span>
                </div>
                <p class="text-3xl text-primary font-bold mt-2">
                  {revealData.translation}
                </p>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Mascot / Message -->
        <div class="flex items-center gap-4 w-full">
          <div class="relative shrink-0">
            <div
              class="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-4 border-white dark:border-card-dark shadow-sm"
            >
              <div
                class="relative w-full h-full bg-center bg-no-repeat bg-cover"
                style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAHtbiRDueIDF5dG93OSJIyZKuRIRLlcyxXs6AUZMiU-9aGsAiT0cmyilThWjVnUd8HncuM6tyVQo0HLzla2MLZObHjhQG_-ks2RTmKJdTD0rZeIA5UwJc9x5oGzePsCsuVNFqZipOpeh8c3WeA8hU7qWDmD-p7HYBMr5wbrhjlW-NSPv9a-BNsFgsjJE16Y9R8FB_TcoOWt13bC-mz8kZuaxF2rqTbWIjwFQNVjsse8J7VtVwpyLBaBXTlA9tNt4Ik7tcAzGjO7xU');"
              ></div>
            </div>
          </div>
          <div
            class="flex-1 bg-white dark:bg-card-dark p-5 rounded-2xl rounded-bl-none border-2 border-gray-100 dark:border-[#333333] shadow-sm relative"
          >
            <p class="text-gray-600 dark:text-gray-300 font-medium">
              {#if view === 'question'}
                Try to recall the meaning before looking at hints!
              {:else if answerMode === 'easy'}
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
      class="fixed bottom-0 left-0 right-0 bg-white dark:bg-background-dark border-t-2 border-gray-100 dark:border-[#2A2A2A] p-4 z-50"
    >
      <div
        class="max-w-[1024px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4"
      >
        {#if view === 'question'}
          <button
            onclick={showNotSureAnswer}
            class="w-full md:w-64 h-12 bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-[#333333] text-gray-500 dark:text-gray-300 rounded-xl text-base font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_4px_0_0_#e5e7eb] dark:shadow-[0_4px_0_0_#1a1a1a] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
          >
            <span>Not Sure</span>
            <span
              class="keycap inline-flex items-center justify-center bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-gray-700 text-[10px] text-gray-400 px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]"
            >
              SPACE
            </span>
          </button>
          <button
            onclick={showEasyAnswer}
            class="w-full md:w-64 h-12 bg-primary text-white rounded-xl text-base font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_4px_0_0_#cc7000] hover:bg-[#ff9a24] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
          >
            <span>Easy</span>
            <span
              class="keycap-orange inline-flex items-center justify-center bg-primary-dark border border-white/20 text-[10px] text-white px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]"
            >
              ENTER
            </span>
          </button>
        {:else}
          <button
            onclick={revealMore}
            disabled={!hasMoreReveal || answerMode === 'easy'}
            class="w-full md:w-64 h-12 bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-[#333333] text-gray-500 dark:text-gray-300 rounded-xl text-base font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_4px_0_0_#e5e7eb] dark:shadow-[0_4px_0_0_#1a1a1a] active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Next Hint</span>
            <span
              class="keycap inline-flex items-center justify-center bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-gray-700 text-[10px] text-gray-400 px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]"
            >
              SPACE
            </span>
          </button>
          <button
            onclick={nextCard}
            class="w-full md:w-64 h-12 bg-primary text-white rounded-xl text-base font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_4px_0_0_#cc7000] hover:bg-[#ff9a24] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
          >
            <span>Continue</span>
            <span
              class="keycap-orange inline-flex items-center justify-center bg-primary-dark border border-white/20 text-[10px] text-white px-2 py-0.5 rounded-md font-black tracking-normal h-5 min-w-[50px]"
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
  .practice-card--swipe-out {
    animation: cardSwipeOut 170ms ease-in forwards;
    will-change: transform, opacity;
  }
  .practice-card--swipe-in {
    animation: cardSwipeIn 210ms ease-out;
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
    animation: cardSettle 220ms ease-out;
    will-change: transform;
  }

  .easy-burst {
    animation: easyPop 320ms ease-out;
    will-change: transform, opacity;
  }
  @keyframes cardSettle {
    0% {
      transform: translateY(8px) scale(0.98);
    }
    100% {
      transform: translateY(0) scale(1);
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
