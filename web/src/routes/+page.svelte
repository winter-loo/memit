<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import {
    PUBLIC_API_BASE_URL,
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY
  } from '$env/static/public';
  import { createClient } from '@supabase/supabase-js';
  import AddWord from '../components/AddWord.svelte';
  import WordCard from '../components/WordCard.svelte';
  import SkeletonCard from '../components/SkeletonCard.svelte';
  import WordDetail from '../components/WordDetail.svelte';
  import Auth from '../components/Auth.svelte';
  import ExtensionAuthHelp from '../components/ExtensionAuthHelp.svelte';

  /** @typedef {{ id: string | number, fields?: string[], loading?: boolean }} Note */

  /** @type {Note[]} */
  let notes = $state([]);
  let loadingNotes = $state(true);
  let loadingAuth = $state(true);
  /** @type {import('@supabase/supabase-js').SupabaseClient | undefined} */
  let supabase = $state();
  /** @type {import('@supabase/supabase-js').Session | null} */
  let session = $state(null);
  /** @type {Note | null} */
  let selectedNote = $state(null);

  let clickStartTime = 0;

  const API_BASE = (PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

  let isExtensionAuthFlow = $state(false);

  let redirectSecondsRemaining = $state(8);

  function goHomeNow() {
    goto(resolve('/'), { replaceState: true });
  }

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
        const loadedNotes = Array.isArray(data) ? data : [];
        // Sort by id descending (assuming id is timestamp) to show newest first
        notes = loadedNotes
          .sort((a, b) => Number(b.id) - Number(a.id))
          .map((n) => {
            const rawBack = n.fields?.[1] || '';
            let parsed = {};
            try {
              parsed = JSON.parse(rawBack);
            } catch {
              // fallback if not json
            }
            return {
              ...n,
              _parsed: parsed
            };
          });
      }
    } catch (e) {
      console.error(e);
    } finally {
      loadingNotes = false;
    }
  }

  /** @param {string | number} noteId */
  async function deleteNote(noteId) {
    if (!noteId) return;
    if (!confirm('Delete this note?')) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      await fetch(`${API_BASE}/api/note/delete/@${noteId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      });
      await loadNotes();
      if (selectedNote?.id === noteId) selectedNote = null;
    } catch (e) {
      console.error(e);
    }
  }

  /** @param {string} text */
  function onAddingWord(text) {
    const tempNote = {
      id: 'temp-' + Date.now(),
      fields: [text, '...'],
      loading: true
    };
    notes = [tempNote, ...notes];
  }

  function handleMouseDown() {
    clickStartTime = Date.now();
  }

  /** @param {Note} note */
  function handleCardClick(note) {
    if (Date.now() - clickStartTime < 200) {
      selectedNote = note;
    }
  }

  onMount(async () => {
    supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    const { data } = await supabase.auth.getSession();
    session = data.session;

    supabase.auth.onAuthStateChange((_event, _session) => {
      session = _session;
      if (session) {
        loadNotes();
      } else {
        notes = [];
      }
    });

    if (session) {
      loadNotes();
    }
    loadingAuth = false;
  });

  $effect(() => {
    if (!browser) return;
    const href = $page.url.href;
    try {
      const url = new URL(href);
      isExtensionAuthFlow = url.searchParams.get('memit_ext_auth') === '1';
    } catch {
      isExtensionAuthFlow = false;
    }
  });

  $effect(() => {
    if (!session || !isExtensionAuthFlow) return;

    const durationMs = 8000;
    const endAt = Date.now() + durationMs;
    redirectSecondsRemaining = Math.ceil(durationMs / 1000);

    const interval = setInterval(() => {
      const remainingMs = endAt - Date.now();
      redirectSecondsRemaining = Math.max(0, Math.ceil(remainingMs / 1000));
    }, 250);

    const timeout = setTimeout(() => {
      goto(resolve('/'), { replaceState: true });
    }, durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  });
</script>

{#if loadingAuth}
  <div class="h-full flex items-center justify-center">
    <div
      class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
    ></div>
  </div>
{:else if !session}
  <Auth {supabase} />
{:else if isExtensionAuthFlow}
  <ExtensionAuthHelp secondsRemaining={redirectSecondsRemaining} onGoHome={goHomeNow} />
{:else if selectedNote}
  <WordDetail note={selectedNote} onClose={() => (selectedNote = null)} />
{:else}
  <div
    class="sticky top-0 z-10 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b-2 border-slate-100 dark:border-slate-800 px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between gap-3"
  >
    <h1
      class="text-2xl font-fredoka font-bold text-slate-800 dark:text-white flex items-center gap-2"
    >
      Recently Added
      <span class="material-symbols-outlined text-primary text-xl sparkle-float">auto_awesome</span>
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
  <div class="p-4 sm:p-8 space-y-6 sm:space-y-8">
    <AddWord {supabase} onNoteAdded={loadNotes} onAdding={onAddingWord} />
    <div class="space-y-6">
      {#if loadingNotes && notes.length === 0}
        <div class="text-center text-slate-500">Loading...</div>
      {:else if notes.length === 0}
        <div class="text-center text-slate-500">No notes yet.</div>
      {:else}
        {#each notes as note (note.id)}
          {#if note.loading}
            <SkeletonCard word={note.fields?.[0] || '...'} />
          {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div onmousedown={handleMouseDown} onclick={() => handleCardClick(note)}>
              <WordCard
                word={{
                  text: note.fields?.[0] || 'Unknown',
                  addedTime: 'Just now',
                  definition: note._parsed?.definition || note.fields?.[1] || '...',
                  translation: note._parsed?.translation || '',
                  pos: note._parsed?.pos || '',
                  ipa: note._parsed?.ipa || ''
                }}
                onDelete={() => deleteNote(note.id)}
              />
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  </div>
{/if}
