<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import { termDetailsCache } from '$lib/cache';
  import { withPreparedFields } from '$lib/notes';
  import { formatRelativeTime } from '$lib/time';

  let { note, onClose } = $props();

  /** @typedef {{ term?: string, translation?: string, simpleDefinition?: string, detailedExplanation?: string, ipaPronunciation?: string, partOfSpeech?: string, examples?: string[], error?: string, etymology?: string, contextUsage?: string, synonyms?: string[], antonyms?: string[], pageUrl?: string, highlights?: string[] }} ExplainResult */

  /** @type {ExplainResult | null} */
  let details = $state(null);
  let loading = $state(true);
  let error = $state('');

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
      // Swipe Right -> Go Back
      onClose();
    }
  }

  /** @param {string} text @param {string[]} [highlights] */
  function highlightText(text, highlights) {
    if (!text) return '';
    if (!highlights || highlights.length === 0) return text;

    // Escape HTML first
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const sorted = [...highlights].sort((a, b) => b.length - a.length);
    if (sorted.length === 0) return escaped;

    const pattern = sorted.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    return escaped.replace(
      regex,
      '<span class="bg-primary/20 text-slate-900 dark:text-white rounded px-0.5">$1</span>'
    );
  }

  /** @param {any} prepared */
  function mapPreparedNoteToDetails(prepared) {
    return {
      term: prepared._term,
      translation: prepared._translation,
      simpleDefinition: prepared._simpleDefinition,
      ipaPronunciation: prepared._ipa,
      detailedExplanation: prepared._detailedExplanation,
      etymology: prepared._etymology,
      contextUsage: prepared._contextUsage,
      examples: prepared._examples || [],
      synonyms: prepared._synonyms || [],
      antonyms: prepared._antonyms || [],
      pageUrl: prepared._sourceUrl,
      highlights: prepared._highlights || []
    };
  }

  async function loadDetails() {
    error = '';
    const prepared = withPreparedFields(note || {});
    const term = prepared._term;
    if (!term) {
      loading = false;
      return;
    }

    details = mapPreparedNoteToDetails(prepared);

    if (termDetailsCache.has(term)) {
      details = { ...details, ...termDetailsCache.get(term) };
      loading = false;
      return;
    }

    // Current API already gives us the detail fields we need.
    // Only fall back to /explain if the note is unusually sparse.
    if (details.simpleDefinition || details.translation || details.detailedExplanation) {
      termDetailsCache.set(term, details);
      loading = false;
      return;
    }

    loading = true;
    try {
      const res = await apiFetch(`/explain/${encodeURIComponent(term)}`);
      details = { ...details, ...(await res.json()) };
      termDetailsCache.set(term, details);
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

<!-- eslint-disable svelte/no-at-html-tags -->

<div
  class="sticky top-0 z-40 relative bg-slate-50 dark:bg-midnight-navy border-b-2 border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center gap-6"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  role="region"
  aria-label="Word Detail View"
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
          {details?.term || note.fields?.term || 'Unknown'}
        </h2>
        <p class="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html highlightText(
            details?.simpleDefinition || note.fields?.simpleDefinition || '',
            details?.highlights
          )}
        </p>
        <p class="text-2xl font-fredoka font-bold text-primary flex items-center gap-2">
          <span class="material-symbols-outlined text-xl">translate</span>
          {details?.translation || 'Translation'}
        </p>

        {#if details?.pageUrl}
          <!-- eslint-disable svelte/no-navigation-without-resolve -->
          <a
            class="mt-2 inline-block text-sm text-slate-400 hover:text-primary underline break-all"
            href={details.pageUrl}
            target="_blank"
            rel="noreferrer"
          >
            Source: {details.pageUrl}
          </a>
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        {/if}
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
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html highlightText(
              details?.detailedExplanation || 'No detailed explanation available.',
              details?.highlights
            )}
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
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  <span>{@html highlightText(example, details.highlights)}</span>
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
            {details?.etymology || `Etymology information for ${details?.term || note.fields?.term || 'this term'} not available.`}
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
