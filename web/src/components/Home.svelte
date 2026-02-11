<script>
  import { PUBLIC_API_BASE_URL } from '$env/static/public';
  import { onMount } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import RightSidebar from './RightSidebar.svelte';
  import WordCard from './WordCard.svelte';

  /** @typedef {{ id: string | number, fields?: string[] }} Note */
  /** @typedef {{ word?: string, in_chinese?: string, simple_definition?: string, detailed_explanation?: string, ipa_pronunciation?: string, part_of_speech?: string, examples?: string[], error?: string }} ExplainResult */

  let { user = null, supabase = null } = $props();

  /** @type {Note[]} */
  let notes = $state([]);
  let loadingNotes = $state(true);

  // explain
  let explainText = $state('');
  let explainLoading = $state(false);
  /** @type {ExplainResult | null} */
  let explainResult = $state(null);
  let explainError = $state('');

  async function getAccessToken() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.access_token || null;
  }

  const API_BASE = (PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

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
    if (user?.id) {
      headers.set('X-User-Id', String(user.id));
    }
    const res = await fetch(apiUrl(path), { ...options, headers });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${t}`);
    }
    return res;
  }

  async function loadNotes() {
    loadingNotes = true;
    try {
      const res = await apiFetch('/api/note/list');
      const data = await res.json();
      notes = Array.isArray(data) ? data : [];
    } catch (e) {
      console.error(e);
      notes = [];
    } finally {
      loadingNotes = false;
    }
  }

  async function explainWord() {
    const text = (explainText || '').trim();
    if (!text) return;
    explainLoading = true;
    explainError = '';
    explainResult = null;
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
    const word = explainResult?.word || explainText;
    const simple = explainResult?.simple_definition || '';
    const translation = explainResult?.in_chinese || '';
    const pos = explainResult?.part_of_speech || '';
    const ipa = explainResult?.ipa_pronunciation || '';

    try {
      await apiFetch('/api/note/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: [word, simple, translation, pos, ipa] })
      });
      explainText = '';
      explainResult = null;
      await loadNotes();
    } catch (e) {
      explainError = e instanceof Error ? e.message : String(e);
    }
  }

  /** @param {string | number} noteId */
  async function deleteNote(noteId) {
    if (!noteId) return;
    if (!confirm('Delete this note?')) return;
    try {
      await apiFetch(`/api/note/delete/@${noteId}`, { method: 'POST' });
      await loadNotes();
    } catch (e) {
      console.error(e);
    }
  }

  onMount(() => {
    loadNotes();
  });
</script>

<div class="max-w-7xl mx-auto flex min-h-screen">
  <Sidebar />

  <main
    class="flex-grow border-r-2 border-slate-100 dark:border-slate-800 max-w-2xl bg-slate-50/50"
  >
    <div
      class="sticky top-0 z-40 relative bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b-2 border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between"
    >
      <h1
        class="text-2xl font-fredoka font-bold text-slate-800 dark:text-white flex items-center gap-2"
      >
        Recently Added
        <span class="material-symbols-outlined text-primary text-xl sparkle-float"
          >auto_awesome</span
        >
        <span
          class="material-symbols-outlined text-primary-light text-lg sparkle-float"
          style="animation-delay: 1.5s">auto_awesome</span
        >
      </h1>
      <div class="flex gap-4 items-center">
        <div
          class="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-2xl text-primary font-bold text-sm"
        >
          <span class="material-symbols-outlined text-base fill-1">local_fire_department</span>
          {notes.length}
        </div>
      </div>
    </div>

    <div class="p-8 space-y-8">
      <!-- Add Card Input -->
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

      <div class="space-y-6">
        {#if loadingNotes}
          <div class="p-6 text-center text-slate-500">Loading notes...</div>
        {:else if notes.length === 0}
          <div class="p-6 text-center text-slate-500">No notes yet. Add one above!</div>
        {:else}
          {#each notes as note (note.id)}
            <WordCard
              word={{
                text: note.fields?.[0] || 'Unknown',
                definition: note.fields?.[1] || 'No definition',
                translation: note.fields?.[2] || '',
                pos: note.fields?.[3] || '',
                ipa: note.fields?.[4] || '',
                addedTime: 'Just now'
              }}
              onDelete={() => deleteNote(note.id)}
            />
          {/each}
        {/if}
      </div>
    </div>
  </main>

  <RightSidebar />
</div>
