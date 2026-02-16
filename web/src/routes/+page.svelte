<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import AddWord from '../components/AddWord.svelte';
  import AddWordInputSkeleton from '../components/AddWordInputSkeleton.svelte';
  import WordCard from '../components/WordCard.svelte';
  import WordListItemSkeleton from '../components/WordListItemSkeleton.svelte';
  import WordDetail from '../components/WordDetail.svelte';
  import Auth from '../components/Auth.svelte';
  import ExtensionAuthHelp from '../components/ExtensionAuthHelp.svelte';

  import { apiFetchAuthed } from '$lib/api';
  import { isExtensionAuthFlowHref } from '$lib/extension-auth';
  import { fetchPreparedNotes } from '$lib/notes';
  import { getSupabaseClient } from '$lib/supabase';
  import { formatRelativeTime } from '../lib/time';

  /** @typedef {{ id: string | number, fields?: string[], loading?: boolean, _parsed?: Record<string, any>, mtimeSecs?: number }} Note */

  /** @type {Note[]} */
  let notes = $state([]);
  let loadingNotes = $state(true);
  let loadingAuth = $state(true);
  let error = $state(''); // Error state for note loading
  /** @type {import('@supabase/supabase-js').SupabaseClient | undefined} */
  let supabase = $state();
  /** @type {import('@supabase/supabase-js').Session | null} */
  let session = $state(null);
  /** @type {Note | null} */
  let selectedNote = $state(null);

  let clickStartTime = 0;

  let isExtensionAuthFlow = $derived.by(() => isExtensionAuthFlowHref(page.url.href));

  let redirectSecondsRemaining = $state(8);
  const listSkeletonIndexes = [0, 1, 2];

  function goHomeNow() {
    goto(resolve('/'), { replaceState: true });
  }

  async function loadNotes() {
    loadingNotes = true;
    error = '';
    try {
      notes = /** @type {Note[]} */ (await fetchPreparedNotes(supabase));
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('HTTP 401') || msg.includes('Not signed in')) {
        // Token expired/invalid. Force sign out.
        if (supabase) {
          await supabase.auth.signOut();
          session = null;
        }
        window.location.reload();
      } else {
        error = 'Failed to load notes. Please try again.';
      }
    } finally {
      loadingNotes = false;
    }
  }

  /** @param {string | number} noteId */
  async function deleteNote(noteId) {
    if (!noteId) return;
    if (!confirm('Delete this note?')) return;
    try {
      await apiFetchAuthed(supabase, `/api/note/delete/@${noteId}`, {
        method: 'POST'
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

  onMount(() => {
    supabase = getSupabaseClient();
    let active = true;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, _session) => {
      if (!active) return;
      const prevToken = session?.access_token || null;
      const nextToken = _session?.access_token || null;
      if (prevToken === nextToken) return;
      session = _session;
      if (session) {
        void loadNotes();
      } else {
        notes = [];
        loadingNotes = false;
      }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      session = data.session;
      loadingAuth = false;
      if (session) {
        void loadNotes();
      } else {
        notes = [];
        loadingNotes = false;
      }
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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

{#if !loadingAuth && !session}
  <Auth {supabase} />
{:else if !loadingAuth && isExtensionAuthFlow}
  <ExtensionAuthHelp secondsRemaining={redirectSecondsRemaining} onGoHome={goHomeNow} />
{:else if !loadingAuth && selectedNote}
  <WordDetail note={selectedNote} onClose={() => (selectedNote = null)} />
{:else}
  <div
    class="sticky top-0 z-40 relative bg-slate-50 dark:bg-midnight-navy border-b-2 border-slate-100 dark:border-slate-800 px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between gap-3"
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
        <span class="material-icons-round text-base">local_fire_department</span>
        {notes.length}
      </div>
    </div>
  </div>
  <div class="p-4 sm:p-8 space-y-6 sm:space-y-8">
    {#if loadingAuth}
      <AddWordInputSkeleton />
    {:else if session}
      <AddWord {supabase} onNoteAdded={loadNotes} onAdding={onAddingWord} />
    {/if}
    <div class="space-y-6">
      {#if error}
        <div class="text-center text-red-500 py-10">
          <p>{error}</p>
          <button class="mt-2 text-primary font-bold hover:underline" onclick={loadNotes}
            >Retry</button
          >
        </div>
      {:else if (loadingAuth || loadingNotes) && notes.length === 0}
        {#each listSkeletonIndexes as idx (idx)}
          <WordListItemSkeleton />
        {/each}
      {:else if notes.length === 0}
        <div class="text-center text-slate-500">No notes yet.</div>
      {:else}
        {#each notes as note (note.id)}
          {#if note.loading}
            <WordListItemSkeleton />
          {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div onmousedown={handleMouseDown} onclick={() => handleCardClick(note)}>
              <WordCard
                word={{
                  text: note.fields?.[0] || 'Unknown',
                  addedTime: formatRelativeTime(note.mtimeSecs),
                  definition: note._parsed?.simple_definition || 'Processing...',
                  translation: note._parsed?.in_chinese || '',
                  ipa: note._parsed?.ipa_pronunciation || ''
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
