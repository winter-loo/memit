<script>
  import { onMount } from 'svelte';
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
</script>

{#if loadingAuth}
  <div class="h-full flex items-center justify-center">
    <div
      class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
    ></div>
  </div>
{:else if !session}
  <Auth {supabase} />
{:else if selectedNote}
  <WordDetail note={selectedNote} onClose={() => (selectedNote = null)} />
{:else}
  <div
    class="sticky top-0 z-10 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b-2 border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between"
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
  <div class="p-8 space-y-8">
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
                  text: note.fields?.[0],
                  addedTime: 'Just now',
                  definition: note.fields?.[1],
                  translation: note.fields?.[2] || '',
                  pos: note.fields?.[3] || '',
                  ipa: note.fields?.[4] || ''
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
