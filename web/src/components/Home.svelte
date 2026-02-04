<script>
  import { PUBLIC_API_BASE_URL } from '$env/static/public';
  import {
    BookOpen,
    House,
    Brain,
    History,
    Settings,
    User,
    LogOut,
    Search,
    Volume2,
    Trash2
  } from '@lucide/svelte';
  import { onMount } from 'svelte';

  /** @typedef {{ id: string | number, fields?: string[] }} Note */
  /** @typedef {{ word?: string, in_chinese?: string, simple_definition?: string, detailed_explanation?: string, ipa_pronunciation?: string, part_of_speech?: string, examples?: string[], error?: string }} ExplainResult */

  let { user = null, supabase = null } = $props();

  /** @type {Note[]} */
  let notes = $state([]);
  let loadingNotes = $state(true);
  let notesError = $state('');

  // daily total
  let dailyStudied = $state(0);
  const dailyGoal = 20;
  let dailyError = $state('');

  // explain
  let explainText = $state('');
  let explainLoading = $state(false);
  let explainError = $state('');
  /** @type {ExplainResult | null} */
  let explainResult = $state(null);

  /** @param {unknown} e */
  function toErrorMessage(e) {
    return e instanceof Error ? e.message : String(e);
  }

  async function getAccessToken() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
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
    const res = await fetch(apiUrl(path), { ...options, headers });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${t}`);
    }
    return res;
  }

  async function loadNotes() {
    loadingNotes = true;
    notesError = '';
    try {
      const res = await apiFetch('/api/note/list');
      const data = await res.json();
      // Expect: [{ id, fields: [front, back] }, ...]
      notes = Array.isArray(data) ? data : [];
    } catch (e) {
      notesError = toErrorMessage(e);
      notes = [];
    } finally {
      loadingNotes = false;
    }
  }

  /** @param {unknown} v */
  function coerceToInt(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
    if (typeof v === 'string') {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : 0;
    }
    if (v && typeof v === 'object') {
      // best-effort: try common field names
      const record = /** @type {Record<string, unknown>} */ (v);
      for (const key of ['count', 'total', 'studied', 'studied_today', 'cards', 'cards_studied']) {
        if (key in record) return coerceToInt(record[key]);
      }
    }
    return 0;
  }

  async function loadDailyTotal() {
    dailyError = '';
    try {
      const res = await apiFetch('/api/note/studied_today');
      const data = await res.json();
      dailyStudied = coerceToInt(data?.msg ?? data);
    } catch (e) {
      dailyError = toErrorMessage(e);
      dailyStudied = 0;
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.reload();
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
      explainResult = await res.json();
      if (explainResult?.error) {
        throw new Error(explainResult.error);
      }
    } catch (e) {
      explainError = toErrorMessage(e);
    } finally {
      explainLoading = false;
    }
  }

  async function addExplainedNote() {
    if (!explainResult) return;
    const front = String(explainResult.word || explainText || '').trim();
    const back = String(explainResult.in_chinese || explainResult.simple_definition || '').trim();
    if (!front) return;

    try {
      await apiFetch('/api/note/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: [front, back] })
      });
      await loadNotes();
    } catch (e) {
      explainError = toErrorMessage(e);
    }
  }

  /** @param {string | number} noteId */
  async function deleteNote(noteId) {
    if (!noteId) return;
    const ok = confirm('Delete this note?');
    if (!ok) return;
    try {
      await apiFetch(`/api/note/delete/@${noteId}`, {
        method: 'POST'
      });
      await loadNotes();
    } catch (e) {
      notesError = toErrorMessage(e);
    }
  }

  onMount(() => {
    loadNotes();
    loadDailyTotal();
  });
</script>

<div class="max-w-7xl mx-auto flex min-h-screen font-display">
  <!-- Sidebar -->
  <aside
    class="hidden md:flex w-64 flex-shrink-0 border-r border-slate-100 dark:border-slate-800 flex-col sticky top-0 h-screen px-4 py-6 bg-background-light dark:bg-background-dark"
  >
    <div class="mb-8 px-4 flex items-center gap-3">
      <div
        class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20"
      >
        <BookOpen class="text-white" size={18} strokeWidth={2.2} />
      </div>
      <span class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">memit</span>
    </div>

    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <nav class="space-y-1 flex-grow">
      <a
        class="sidebar-item flex items-center gap-4 px-4 py-3 rounded-xl bg-primary/10 text-primary font-bold"
        href="/"
      >
        <House size={18} />
        <span class="text-lg">Home</span>
      </a>
      <a
        class="sidebar-item flex items-center gap-4 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        href="/practice"
      >
        <Brain size={18} />
        <span class="text-lg">Practice</span>
      </a>
      <a
        class="sidebar-item flex items-center gap-4 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        href="/history"
      >
        <History size={18} />
        <span class="text-lg">History</span>
      </a>
      <a
        class="sidebar-item flex items-center gap-4 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        href="/settings"
      >
        <Settings size={18} />
        <span class="text-lg">Settings</span>
      </a>
    </nav>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->

    <div class="mt-auto relative group">
      <div
        class="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors"
      >
        <div
          class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 overflow-hidden"
        >
          <User size={18} />
        </div>
        <div class="flex-grow min-w-0">
          <p class="text-sm font-bold truncate text-slate-900 dark:text-white">
            {user?.email?.split('@')[0] || 'User'}
          </p>
          <p class="text-xs text-slate-500 truncate">@{user?.email?.split('@')[0] || 'user'}</p>
        </div>
        <button
          class="text-slate-400 hover:text-red-500 transition-colors"
          title="Sign out"
          onclick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-grow border-r border-slate-100 dark:border-slate-800 max-w-2xl w-full">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800"
    >
      <div class="px-4 py-4 flex justify-between items-center md:hidden">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <BookOpen class="text-white" size={18} strokeWidth={2.2} />
          </div>
          <span class="font-bold text-lg">memit</span>
        </div>
        <button class="text-slate-600" onclick={handleSignOut} aria-label="Sign out">
          <LogOut size={18} />
        </button>
      </div>
      <div class="px-4 py-4 hidden md:block">
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">Recently Added</h1>
      </div>
    </div>

    <!-- Add Input -->
    <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-4">
      <div
        class="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center"
      >
        <User class="text-slate-400" size={18} />
      </div>
      <div class="flex-grow">
        <textarea
          class="w-full bg-transparent border-none focus:ring-0 text-xl resize-none py-2 placeholder-slate-400 dark:placeholder-slate-600 text-slate-900 dark:text-white"
          placeholder="Quickly add a new word..."
          rows="2"
          bind:value={explainText}
        ></textarea>
        <div class="flex items-center justify-end pt-3 mt-1">
          <button
            class="bg-primary text-white px-6 py-2 rounded-full font-bold hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 disabled:opacity-50"
            onclick={explainWord}
            disabled={explainLoading || !explainText.trim()}
          >
            {#if explainLoading}Explaining…{:else}explain{/if}
          </button>
        </div>

        {#if explainError}
          <div class="mt-3 text-sm text-red-500 whitespace-pre-wrap">{explainError}</div>
        {/if}

        {#if explainResult}
          <div
            class="mt-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-lg font-bold text-slate-900 dark:text-white">
                  {explainResult.word}
                </div>
                {#if explainResult.ipa_pronunciation}
                  <div class="text-sm text-slate-500">/{explainResult.ipa_pronunciation}/</div>
                {/if}
                {#if explainResult.part_of_speech}
                  <div class="text-xs text-slate-500 mt-1">{explainResult.part_of_speech}</div>
                {/if}
              </div>
              <button
                class="text-xs bg-primary/10 text-primary font-bold px-3 py-2 rounded-full hover:bg-primary/15"
                onclick={addExplainedNote}
                title="Add to your deck"
              >
                Add
              </button>
            </div>

            {#if explainResult.in_chinese}
              <div class="mt-3 text-primary font-medium">{explainResult.in_chinese}</div>
            {/if}

            {#if explainResult.simple_definition}
              <div class="mt-2 text-slate-700 dark:text-slate-200">
                {explainResult.simple_definition}
              </div>
            {/if}

            {#if explainResult.detailed_explanation}
              <div class="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                {explainResult.detailed_explanation}
              </div>
            {/if}

            {#if Array.isArray(explainResult.examples) && explainResult.examples.length}
              <div class="mt-4">
                <div class="text-xs font-bold text-slate-500 mb-2">Examples</div>
                <ul class="list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                  {#each explainResult.examples.slice(0, 3) as ex, i (i)}
                    <li>{ex}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Feed -->
    <div class="divide-y divide-slate-100 dark:divide-slate-800">
      {#if loadingNotes}
        <div class="p-6 text-slate-500">Loading…</div>
      {:else if notesError}
        <div class="p-6 text-red-500">
          <div class="font-semibold mb-2">Failed to load notes</div>
          <div class="text-xs whitespace-pre-wrap">{notesError}</div>
          <button
            class="mt-3 px-4 py-2 rounded-full bg-primary text-white font-bold"
            onclick={loadNotes}>Retry</button
          >
        </div>
      {:else if notes.length === 0}
        <div class="p-6 text-slate-500">No notes yet. Add one above.</div>
      {:else}
        {#each notes as note (note.id)}
          <article
            class="p-4 py-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
          >
            <div class="flex items-start justify-between">
              <div class="space-y-1">
                <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {note.fields?.[0] || ''}
                </h2>
                {#if note.fields?.[1]}
                  <p class="text-primary font-medium">{note.fields[1]}</p>
                {/if}
              </div>
              <div
                class="flex items-center gap-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <button class="text-slate-400 hover:text-primary" aria-label="Play pronunciation"
                  ><Volume2 size={18} /></button
                >
                <button
                  class="text-slate-400 hover:text-red-500"
                  aria-label="Delete"
                  title="Delete"
                  onclick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}><Trash2 size={18} /></button
                >
              </div>
            </div>
          </article>
        {/each}
      {/if}
    </div>
  </main>

  <!-- Right Sidebar (Search/Widgets) - Optional, kept minimal as per design -->
  <aside
    class="hidden xl:block w-80 px-6 py-6 border-l border-slate-100 dark:border-slate-800 sticky top-0 h-screen"
  >
    <div class="relative mb-6">
      <span class="absolute left-4 top-3 text-slate-400"><Search size={18} /></span>
      <input
        type="text"
        placeholder="Search vocabulary..."
        class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-full py-3 pl-12 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-black transition-all"
      />
    </div>

    <div class="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
      <h3 class="font-bold text-lg mb-4 text-slate-900 dark:text-white">Daily Total</h3>
      <div class="flex items-end gap-2 mb-2">
        <span class="text-3xl font-bold text-primary">{dailyStudied}</span>
        <span class="text-slate-500 pb-1">/ {dailyGoal} cards</span>
      </div>
      <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
        <div
          class="bg-primary h-2.5 rounded-full"
          style="width: {Math.min(100, Math.round((dailyStudied / dailyGoal) * 100))}%"
        ></div>
      </div>
      {#if dailyError}
        <div class="mt-2 text-xs text-red-500 whitespace-pre-wrap">{dailyError}</div>
      {/if}
    </div>
  </aside>
</div>
