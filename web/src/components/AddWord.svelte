<script>
  import { PUBLIC_API_BASE_URL } from '$env/static/public';

  /** @typedef {{ word?: string, in_chinese?: string, simple_definition?: string, detailed_explanation?: string, ipa_pronunciation?: string, part_of_speech?: string, examples?: string[], error?: string }} ExplainResult */

  let { supabase, onNoteAdded, onAdding } = $props();

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
    if (!text) return;

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
    const back = explainResult?.in_chinese || explainResult?.simple_definition || '...';

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
</script>

<div class="card-3d-soft p-6 rounded-4xl bg-white dark:bg-card-dark flex gap-4">
  <div class="relative">
    <img
      alt="User Avatar"
      class="w-14 h-14 rounded-2xl flex-shrink-0"
      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvHo8CB37FgWxYK2Rxkw_PqFZFp0QolAqzQI8HjdnuLjLL6SBT66HSmjL8xC7nxEgfCxDMJhjoRiNa-KurJRjU-WnE5dpCuho_8xLoupi34vmnRv8YQUWUzbGOhF0faxH1xNX7BDZa4pEfCA5KL78e8bW4azj8iZHOgaDl9EpLZsJYYQQt39fEE3Kd5tNCFILSWfvUKSRTz8NMOAXYBBPNl_UJ-U_SXN6X2vj_mLlDxDYzzmK9DIegy91R5ZvmSN_oZM_IlpBfoCc"
    />
  </div>
  <div class="flex-grow">
    <textarea
      bind:value={explainText}
      class="w-full bg-transparent border-none focus:ring-0 text-xl font-medium resize-none py-2 placeholder-slate-300 dark:placeholder-slate-600 dark:text-white"
      placeholder="Type a word to learn..."
      rows="1"
    ></textarea>
    <div
      class="flex items-center justify-end pt-3 border-t-2 border-slate-50 dark:border-slate-800 mt-2"
    >
      <button
        onclick={explainWord}
        disabled={explainLoading || !explainText.trim()}
        class="bg-primary btn-3d border-b-primary-dark text-white px-10 py-2.5 rounded-2xl font-fredoka font-bold uppercase tracking-wider text-sm hover:brightness-105 transition-all disabled:opacity-50"
      >
        {explainLoading ? 'Explaining...' : 'Explain'}
      </button>
    </div>
    {#if explainError}
      <p class="text-red-500 text-sm mt-2">{explainError}</p>
    {/if}
  </div>
</div>
