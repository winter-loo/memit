<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import { wordDetailsCache } from '$lib/cache';
  import { parseNoteBack } from '$lib/notes';
  import { formatRelativeTime } from '$lib/time';

  let { note, onClose } = $props();

  /** @typedef {{ word?: string, in_chinese?: string, simple_definition?: string, detailed_explanation?: string, ipa_pronunciation?: string, part_of_speech?: string, examples?: string[], error?: string, etymology?: string, synonyms?: string[], antonyms?: string[] }} ExplainResult */

  /** @type {ExplainResult | null} */
  let details = $state(null);
  let loading = $state(true);
  let error = $state('');

  /** @param {Record<string, any>} parsed @param {string} word */
  function mapParsedToDetails(parsed, word) {
    return {
      ...parsed,
      word,
      in_chinese: parsed.translation || parsed.in_chinese,
      simple_definition: parsed.simple_definition,
      ipa_pronunciation: parsed.ipa_pronunciation,
      etymology: parsed.etymology || parsed.origins
    };
  }

  async function loadDetails() {
    error = '';
    if (!note?.fields?.[0]) {
      loading = false;
      return;
    }
    const word = note.fields[0];

    // Check if we have pre-parsed JSON in note._parsed
    // (This comes from the list page loading logic or similar)
    if (note._parsed && Object.keys(note._parsed).length > 0) {
      details = mapParsedToDetails(note._parsed, word);
      loading = false;
      return;
    }

    // Fallback to cache or live fetch if note._parsed is missing (legacy notes or direct link)
    if (wordDetailsCache.has(word)) {
      details = wordDetailsCache.get(word);
      loading = false;
      return;
    }

    loading = true;
    try {
      const parsed = parseNoteBack(note.fields?.[1] || '');
      if (Object.keys(parsed).length > 0) {
        details = mapParsedToDetails(parsed, word);
        wordDetailsCache.set(word, details);
        loading = false;
        return;
      }

      const res = await apiFetch(`/explain/${encodeURIComponent(word)}`);
      details = await res.json();
      wordDetailsCache.set(word, details);
    } catch (e) {
      console.error(e);
      error = 'Could not load additional details.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadDetails();
  });
</script>

<div
  class="sticky top-0 z-40 relative bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b-2 border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center gap-6"
>
  <button
    onclick={onClose}
    class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
  >
    <span class="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
  </button>
  <div class="flex flex-col">
    <h1 class="text-xl font-fredoka font-bold text-slate-800 dark:text-white leading-tight">
      Word Thread
    </h1>
    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Recently Added</p>
  </div>
</div>

<div class="p-6 space-y-0">
  <!-- Main Card -->
  <div class="relative pb-8">
    <div class="thread-line"></div>
    <div class="flex gap-4">
      <div class="z-10 shrink-0">
        <img
          alt="Bot Avatar"
          class="w-14 h-14 rounded-2xl"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvHo8CB37FgWxYK2Rxkw_PqFZFp0QolAqzQI8HjdnuLjLL6SBT66HSmjL8xC7nxEgfCxDMJhjoRiNa-KurJRjU-WnE5dpCuho_8xLoupi34vmnRv8YQUWUzbGOhF0faxH1xNX7BDZa4pEfCA5KL78e8bW4azj8iZHOgaDl9EpLZsJYYQQt39fEE3Kd5tNCFILSWfvUKSRTz8NMOAXYBBPNl_UJ-U_SXN6X2vj_mLlDxDYzzmK9DIegy91R5ZvmSN_oZM_IlpBfoCc"
        />
      </div>
      <div class="flex-grow pt-1">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="font-fredoka font-bold text-slate-800 dark:text-white">Memit AI</span>
            <span class="material-symbols-outlined text-accent text-sm fill-1">verified</span>
            <span class="text-sm text-slate-400"
              >@memit_bot · {formatRelativeTime(note?.mtimeSecs)}</span
            >
          </div>
          <button class="text-slate-400 hover:text-primary"
            ><span class="material-symbols-outlined">more_horiz</span></button
          >
        </div>
        <h2 class="text-3xl font-fredoka font-bold text-slate-800 dark:text-white mb-2">
          {note.fields?.[0]}
        </h2>
        <p class="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {details?.simple_definition || note.fields?.[1]}
        </p>
        <p class="text-2xl font-fredoka font-bold text-primary flex items-center gap-2">
          <span class="material-symbols-outlined text-xl">translate</span>
          {details?.in_chinese || 'Translation'}
        </p>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="py-10 text-center text-slate-500">Loading details...</div>
  {:else if error}
    <div class="py-10 text-center text-red-500">{error}</div>
  {:else}
    <!-- Detailed Explanation -->
    <div class="relative pb-8">
      <div class="thread-line"></div>
      <div class="flex gap-4">
        <div class="z-10">
          <div
            class="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-accent border-2 border-slate-200 dark:border-slate-600"
          >
            <span class="material-symbols-outlined text-2xl fill-1">lightbulb</span>
          </div>
        </div>
        <div class="flex-grow pt-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-fredoka font-bold text-slate-800 dark:text-white text-sm"
              >Detailed Explanation</span
            >
            <span class="text-xs text-slate-400">@context_ai</span>
          </div>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            {details?.detailed_explanation || 'No detailed explanation available.'}
          </p>
        </div>
      </div>
    </div>

    <!-- Examples -->
    {#if details?.examples && details.examples.length > 0}
      <div class="relative pb-8">
        <div class="thread-line"></div>
        <div class="flex gap-4">
          <div class="z-10">
            <div
              class="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-primary border-2 border-slate-200 dark:border-slate-600"
            >
              <span class="material-symbols-outlined text-2xl fill-1">format_list_bulleted</span>
            </div>
          </div>
          <div class="flex-grow pt-1">
            <div class="flex items-center gap-2 mb-2">
              <span class="font-fredoka font-bold text-slate-800 dark:text-white text-sm"
                >Examples</span
              >
            </div>
            <ul class="space-y-3">
              {#each details.examples as example, i (i)}
                <li class="flex gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <span class="text-primary font-bold">•</span>
                  <span>{example}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    {/if}

    <!-- Origins -->
    <div class="relative pb-8">
      <div class="thread-line"></div>
      <div class="flex gap-4">
        <div class="z-10">
          <div
            class="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-accent border-2 border-slate-200 dark:border-slate-600"
          >
            <span class="material-symbols-outlined text-2xl fill-1">genetics</span>
          </div>
        </div>
        <div class="flex-grow pt-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-fredoka font-bold text-slate-800 dark:text-white text-sm"
              >Origins</span
            >
          </div>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed italic">
            {details?.etymology || `Etymology information for ${note.fields?.[0]} not available.`}
          </p>
        </div>
      </div>
    </div>

    <!-- Synonyms -->
    <div class="relative pb-8">
      <div class="thread-line"></div>
      <div class="flex gap-4">
        <div class="z-10">
          <div
            class="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-green-500 border-2 border-slate-200 dark:border-slate-600"
          >
            <span class="material-symbols-outlined text-2xl fill-1">extension</span>
          </div>
        </div>
        <div class="flex-grow pt-1">
          <div class="flex items-center gap-2 mb-3">
            <span class="font-fredoka font-bold text-slate-800 dark:text-white text-sm"
              >Synonyms</span
            >
          </div>
          <div class="flex flex-wrap gap-2">
            {#if details?.synonyms && details.synonyms.length > 0}
              {#each details.synonyms as synonym, i (i)}
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >{synonym}{i < details.synonyms.length - 1 ? ', ' : ''}</span
                >
              {/each}
            {:else}
              <span class="text-sm text-slate-400">No synonyms available.</span>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Antonyms -->
    <div class="relative pb-12 last-thread-item">
      <div class="thread-line"></div>
      <div class="flex gap-4">
        <div class="z-10">
          <div
            class="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-danger border-2 border-slate-200 dark:border-slate-600"
          >
            <span class="material-symbols-outlined text-2xl fill-1">compare_arrows</span>
          </div>
        </div>
        <div class="flex-grow pt-1">
          <div class="flex items-center gap-2 mb-3">
            <span class="font-fredoka font-bold text-slate-800 dark:text-white text-sm"
              >Antonyms</span
            >
          </div>
          <div class="flex flex-wrap gap-2">
            {#if details?.antonyms && details.antonyms.length > 0}
              {#each details.antonyms as antonym, i (i)}
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >{antonym}{i < details.antonyms.length - 1 ? ', ' : ''}</span
                >
              {/each}
            {:else}
              <span class="text-sm text-slate-400">No antonyms available.</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .thread-line {
    width: 2px;
    background-color: #e2e8f0;
    position: absolute;
    left: 27px;
    top: 60px;
    bottom: -32px;
  }
  :global(.dark) .thread-line {
    background-color: #334155;
  }
  .last-thread-item .thread-line {
    display: none;
  }
</style>
