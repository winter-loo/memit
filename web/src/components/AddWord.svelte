<script>
  import { PUBLIC_API_BASE_URL } from '$env/static/public';

  /** @typedef {{ word?: string, in_chinese?: string, simple_definition?: string, detailed_explanation?: string, ipa_pronunciation?: string, part_of_speech?: string, examples?: string[], error?: string, etymology?: string, origins?: string, synonyms?: string[], antonyms?: string[] }} ExplainResult */

  let { supabase, onNoteAdded, onAdding } = $props();
  const MAX_EXPLAIN_CHARS = 120;

  let explainText = $state('');
  let explainLoading = $state(false);
  let explainError = $state('');
  /** @type {ExplainResult | null} */
  let explainResult = $state(null);

  const API_BASE = (PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

  async function getAccessToken() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.access_token || null;
  }

  /** @param {string} path */
  function apiUrl(path) {
    if (!API_BASE) return path;
    if (path.startsWith('/')) return `${API_BASE}${path}`;
    return `${API_BASE}/${path}`;
  }

  /** @param {string} path @param {RequestInit} [options] */
  async function apiFetch(path, options = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in');
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + token);

    const res = await fetch(apiUrl(path), { ...options, headers });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${t}`);
    }
    return res;
  }

  async function explainWord() {
    const text = (explainText || '').trim();
    if (!text || charCount > MAX_EXPLAIN_CHARS) return;

    explainLoading = true;
    explainError = '';
    explainResult = null;

    if (onAdding) onAdding(text);

    try {
      const res = await fetch(apiUrl(`/explain/${encodeURIComponent(text)}`));
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      /** @type {ExplainResult} */
      const result = await res.json();
      explainResult = result;
      if (result?.error) {
        throw new Error(result.error);
      }
      await addExplainedNote();
    } catch (e) {
      explainError = e instanceof Error ? e.message : String(e);
    } finally {
      explainLoading = false;
    }
  }

  async function addExplainedNote() {
    const front = explainResult?.word || explainText;
    const back = JSON.stringify({
      simple_definition: explainResult?.simple_definition || '...',
      in_chinese: explainResult?.in_chinese || '...',
      detailed_explanation: explainResult?.detailed_explanation,
      examples: explainResult?.examples,
      etymology: explainResult?.etymology || explainResult?.origins,
      synonyms: explainResult?.synonyms,
      antonyms: explainResult?.antonyms,
      ipa_pronunciation: explainResult?.ipa_pronunciation,
      part_of_speech: explainResult?.part_of_speech
    });

    try {
      await apiFetch('/api/note/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: [front, back] })
      });
      explainText = '';
      explainResult = null;
      if (onNoteAdded) onNoteAdded();
    } catch (e) {
      explainError = e instanceof Error ? e.message : String(e);
    }
  }

  /** @param {Event & { currentTarget: EventTarget & HTMLTextAreaElement }} e */
  function autoResize(e) {
    const textarea = e.currentTarget;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  let chars = $derived(Array.from(explainText));
  let charCount = $derived(chars.length);
  let isOverLimit = $derived(charCount > MAX_EXPLAIN_CHARS);
</script>

<div class="card-3d-soft p-6 rounded-4xl bg-white dark:bg-card-dark flex gap-4">
  <div class="relative">
    <img
      alt="User Avatar"
      class="w-14 h-14 rounded-2xl flex-shrink-0"
      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvHo8CB37FgWxYK2Rxkw_PqFZFp0QolAqzQI8HjdnuLjLL6SBT66HSmjL8xC7nxEgfCxDMJhjoRiNa-KurJRjU-WnE5dpCuho_8xLoupi34vmnRv8YQUWUzbGOhF0faxH1xNX7BDZa4pEfCA5KL78e8bW4azj8iZHOgaDl9EpLZsJYYQQt39fEE3Kd5tNCFILSWfvUKSRTz8NMOAXYBBPNl_UJ-U_SXN6X2vj_mLlDxDYzzmK9DIegy91R5ZvmSN_oZM_IlpBfoCc"
    />
  </div>
  <div class="flex-grow flex flex-col relative">
    <div class="relative min-h-[44px]">
      <!-- Backdrop for highlighting -->
      <div
        class="absolute inset-0 w-full h-full text-xl font-medium px-0 py-2 whitespace-pre-wrap break-words pointer-events-none z-0"
        style="font-family: inherit; line-height: 1.5; vertical-align: top;"
        aria-hidden="true"
      >
        {#each chars as char, index (index)}
          {#if index >= MAX_EXPLAIN_CHARS}
            <span class="bg-red-200 dark:bg-red-900/50 text-transparent">{char}</span>
          {:else}
            <span class="text-transparent">{char}</span>
          {/if}
        {/each}
      </div>

      <!-- Transparent Textarea -->
      <textarea
        bind:value={explainText}
        oninput={autoResize}
        class="w-full bg-transparent border-none focus:ring-0 text-xl font-medium resize-none px-0 py-2 placeholder-slate-300 dark:placeholder-slate-600 overflow-hidden min-h-[44px] outline-none shadow-none relative z-10 text-slate-800 dark:text-white break-words whitespace-pre-wrap"
        style="background-color: transparent; vertical-align: top; line-height: 1.5;"
        placeholder="Type a word or phrase..."
        rows="1"
      ></textarea>
    </div>

    <div
      class="flex items-center justify-between pt-3 border-t-2 border-slate-50 dark:border-slate-800 mt-2"
    >
      <span
        class="text-xs font-bold uppercase tracking-widest transition-colors {isOverLimit
          ? 'text-danger'
          : 'text-slate-300'}"
      >
        {charCount} / {MAX_EXPLAIN_CHARS} chars
      </span>
      <button
        onclick={explainWord}
        disabled={explainLoading || !explainText.trim() || isOverLimit}
        class="bg-primary btn-3d border-b-primary-dark text-white px-10 py-2.5 rounded-2xl font-fredoka font-bold uppercase tracking-wider text-sm hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {explainLoading ? 'Explaining...' : 'Explain'}
      </button>
    </div>
    {#if explainError}
      <p class="text-red-500 text-sm mt-2">{explainError}</p>
    {/if}
  </div>
</div>
