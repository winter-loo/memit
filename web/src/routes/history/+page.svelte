<script>
  import { onMount } from 'svelte';
  import HistoryCard from '../../components/HistoryCard.svelte';
  import WordDetail from '../../components/WordDetail.svelte';
  import { fetchPreparedNotes } from '$lib/notes';
  import { getSupabaseClient } from '$lib/supabase';

  /** @typedef {{ simple_definition?: string, in_chinese?: string, [key: string]: any }} ParsedNote */
  /** @typedef {{ id: string | number, fields?: string[], mtimeSecs?: number, _parsed?: ParsedNote }} Note */

  /** @type {Note[]} */
  let notes = $state([]);
  let loading = $state(true);
  /** @type {Note | null} */
  let selectedNote = $state(null);
  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;

  async function loadNotes() {
    loading = true;
    try {
      notes = /** @type {Note[]} */ (await fetchPreparedNotes(supabase));
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    supabase = getSupabaseClient();
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await loadNotes();
      } else {
        loading = false;
      }
    })();
  });

  /** @param {Note} note */
  function openDetail(note) {
    selectedNote = note;
  }
</script>

{#if selectedNote}
  <WordDetail note={selectedNote} onClose={() => (selectedNote = null)} />
{:else}
  <div class="py-4 px-4 sm:py-8 sm:px-8 h-full overflow-y-auto">
    <div class="max-w-7xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-10">
        <div>
          <h1 class="text-3xl font-fredoka font-bold text-slate-800 dark:text-white">
            Vocabulary History
          </h1>
          <p class="text-slate-500 font-medium">Manage and review your saved words</p>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="relative">
            <span
              class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              >search</span
            >
            <input
              class="pl-10 pr-4 py-2 bg-white dark:bg-card-dark border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-0 text-sm font-medium w-full sm:w-64 transition-all dark:text-white"
              placeholder="Search your history..."
              type="text"
            />
          </div>
          <button
            class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-card-dark border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-primary transition-all cursor-pointer"
          >
            <span class="material-symbols-outlined text-lg">filter_list</span>
            Filter
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {#if loading}
          <div class="col-span-full flex justify-center py-20">
            <div
              class="w-8 h-8 border-4 border-slate-100 border-t-primary rounded-full animate-spin opacity-40"
            ></div>
          </div>
        {:else if notes.length === 0}
          <div class="col-span-full text-center text-slate-500 py-20">No history found.</div>
        {:else}
          {#each notes as note (note.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div onclick={() => openDetail(note)}>
              <HistoryCard
                word={{
                  text: note.fields?.[0] || 'Unknown',
                  definition: note._parsed?.simple_definition || 'Processing...',
                  translation: note._parsed?.in_chinese || ''
                }}
              />
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
