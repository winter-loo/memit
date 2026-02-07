<script>
  import { onMount } from 'svelte';
  import {
    PUBLIC_API_BASE_URL,
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY
  } from '$env/static/public';
  import { createClient } from '@supabase/supabase-js';
  import { resolve } from '$app/paths';

  /** @typedef {{ id: string | number, fields?: string[] }} Note */

  /** @type {Note[]} */
  let notes = $state([]);
  let currentIndex = $state(0);
  let view = $state('loading'); // loading, question, answer, complete
  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;

  const API_BASE = (PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

  async function getAccessToken() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.access_token || null;
  }

  async function loadNotes() {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/note/list`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.ok) {
        const data = await res.json();
        notes = Array.isArray(data) ? data : [];
        if (notes.length > 0) {
          view = 'question';
        } else {
          view = 'complete';
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  onMount(async () => {
    supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      await loadNotes();
    }
  });

  function showAnswer() {
    view = 'answer';
  }

  function nextCard() {
    if (currentIndex < notes.length - 1) {
      currentIndex++;
      view = 'question';
    } else {
      view = 'complete';
    }
  }

  let currentNote = $derived(notes[currentIndex] || {});
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
  <!-- Complete View -->
  <div
    class="bg-white dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-300 relative overflow-hidden"
  >
    <div
      class="absolute inset-0 pattern-bg pointer-events-none opacity-10"
      style="background-image: radial-gradient(#f48c25 0.5px, transparent 0.5px); background-size: 40px 40px;"
    ></div>
    <main class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
      <div class="w-full max-w-[600px] flex flex-col items-center text-center gap-8">
        <div class="relative mb-4">
          <div class="relative w-48 h-48 mx-auto z-20">
            <!-- Placeholder for celebration image -->
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
            class="flex-1 bg-white dark:bg-[#2d241a] rounded-2xl p-6 border-2 border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center gap-3"
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
      class="w-full bg-white dark:bg-[#221910] border-t-2 border-gray-100 dark:border-gray-800 p-6 z-20"
    >
      <div class="max-w-[1024px] mx-auto">
        <a
          href={resolve('/')}
          class="block w-full text-center btn-3d bg-primary text-white rounded-xl text-lg font-bold uppercase tracking-widest py-3.5 hover:brightness-110 active:brightness-95 transition-all"
        >
          Continue
        </a>
      </div>
    </footer>
  </div>
{:else}
  <!-- Question/Answer View -->
  <div
    class="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-300"
  >
    <header class="w-full max-w-[1024px] mx-auto px-6 py-8 flex items-center gap-6">
      <a href={resolve('/')} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        <span class="material-symbols-outlined text-3xl font-bold">close</span>
      </a>
      <div class="flex-1 h-4 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          class="h-full bg-primary rounded-full relative transition-all duration-300"
          style="width: {progress}%;"
        >
          <div class="absolute top-1 left-1 right-1 h-1 bg-white/30 rounded-full"></div>
        </div>
      </div>
      <div class="flex items-center gap-2 text-primary">
        <span class="material-symbols-outlined font-bold">favorite</span>
        <span class="text-xl font-bold">5</span>
      </div>
    </header>

    <main class="flex-1 flex flex-col items-center justify-center px-6 pb-32">
      <div class="w-full max-w-[600px] flex flex-col items-center gap-10">
        {#if view === 'question'}
          <div class="w-full text-left">
            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Do you know this word?
            </h2>
          </div>
        {/if}

        <div
          class="w-full bg-white dark:bg-[#2d241a] rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-[0_8px_0_0_#e5e7eb] dark:shadow-[0_8px_0_0_#1a140d] border-2 border-gray-200 dark:border-gray-800"
        >
          <h1 class="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            {currentNote.fields?.[0]}
          </h1>

          {#if view === 'answer'}
            <div class="flex flex-col gap-2 animate-in fade-in zoom-in duration-300">
              <p class="text-xl text-gray-500 dark:text-gray-400 font-medium">
                /{currentNote.fields?.[0]}/
              </p>
              <!-- Mock IPA -->
              <span
                class="px-4 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm font-semibold uppercase tracking-wider mx-auto"
                >definition</span
              >
              <p class="text-xl text-gray-700 dark:text-gray-200 font-medium mt-4">
                {currentNote.fields?.[1]}
              </p>
            </div>
          {:else}
            <div class="flex flex-col gap-2">
              <p class="text-xl text-gray-500 dark:text-gray-400 font-medium">...</p>
            </div>
          {/if}
        </div>

        {#if view === 'question'}
          <div class="flex items-end gap-6 w-full max-w-[420px] mt-4">
            <div class="relative shrink-0">
              <div
                class="w-28 h-28 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-800 shadow-sm"
              >
                <span class="material-symbols-outlined text-4xl text-primary">psychology</span>
              </div>
            </div>
            <div
              class="flex-1 bg-white dark:bg-[#2d241a] p-4 rounded-xl rounded-bl-none border-2 border-gray-200 dark:border-gray-800 shadow-sm mb-6 relative"
            >
              <p class="text-gray-600 dark:text-gray-300 font-medium">Hmm, do you remember?</p>
              <div
                class="absolute -left-2 bottom-0 w-4 h-4 bg-white dark:bg-[#2d241a] border-l-2 border-b-2 border-gray-200 dark:border-gray-800 transform rotate-45 -translate-x-1/2"
              ></div>
            </div>
          </div>
        {/if}
      </div>
    </main>

    <footer
      class="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#221910] border-t-2 border-gray-200 dark:border-gray-800 p-6 z-10"
    >
      <div class="max-w-[1024px] mx-auto flex gap-4 md:gap-6 justify-end">
        {#if view === 'question'}
          <button
            onclick={showAnswer}
            class="flex-1 h-14 bg-white dark:bg-[#2d241a] border-2 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 rounded-xl text-lg font-bold uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-[0_4px_0_0_#e5e7eb] active:translate-y-1 active:shadow-none cursor-pointer"
          >
            Not Sure
          </button>
          <button
            onclick={showAnswer}
            class="flex-1 h-14 bg-primary text-white rounded-xl text-lg font-bold uppercase tracking-wide shadow-[0_4px_0_0_#d67a1f] active:translate-y-1 active:shadow-none cursor-pointer"
          >
            Easy
          </button>
        {:else}
          <button
            onclick={nextCard}
            class="w-full md:w-64 h-14 bg-primary text-white rounded-xl text-lg font-bold uppercase tracking-wide shadow-[0_4px_0_0_#d67a1f] active:translate-y-1 active:shadow-none cursor-pointer"
          >
            Continue
          </button>
        {/if}
      </div>
    </footer>
  </div>
{/if}
