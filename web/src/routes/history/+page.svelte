<script>
  import { onMount } from 'svelte';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
  import { createClient } from '@supabase/supabase-js';
  import HistoryCard from '../../components/HistoryCard.svelte';
  import HistoryDetailModal from '../../components/HistoryDetailModal.svelte';
  import { PUBLIC_API_BASE_URL } from '$env/static/public';

  /** @typedef {{ id: string | number, fields?: string[] }} Note */
  /** @typedef {{ text: string, definition: string, translation: string, ipa: string, detailed_explanation: string }} WordDetail */

  /** @type {Note[]} */
  let notes = $state([]);
  let loading = $state(true);
  /** @type {WordDetail | null} */
  let selectedWord = $state(null);
  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;
  let user;

  const API_BASE = (PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

  async function getAccessToken() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.access_token || null;
  }

  async function loadNotes() {
    loading = true;
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
      loading = false;
    }
  }

  onMount(async () => {
    supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data } = await supabase.auth.getSession();
    user = data?.session?.user;
    if (user) {
      loadNotes();
    }
  });

  /** @param {Note} note */
  function openModal(note) {
    selectedWord = {
      text: note.fields?.[0] || '',
      definition: note.fields?.[1] || '',
      translation: note.fields?.[2] || '',
      ipa: note.fields?.[4] || '',
      detailed_explanation: 'Loading...'
    };
  }
</script>

<div class="py-8 px-8 h-full overflow-y-auto">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-10">
      <div>
        <h1 class="text-3xl font-fredoka font-bold text-slate-800 dark:text-white">
          Vocabulary History
        </h1>
        <p class="text-slate-500 font-medium">Manage and review your saved words</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <span
            class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            >search</span
          >
          <input
            class="pl-10 pr-4 py-2 bg-white dark:bg-card-dark border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-0 text-sm font-medium w-64 transition-all dark:text-white"
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
          <div onclick={() => openModal(note)}>
            <HistoryCard
              word={{
                text: note.fields?.[0] || 'Unknown',
                definition: note.fields?.[1] || '...',
                translation: note.fields?.[2] || 'Translation',
                pos: note.fields?.[3] || '',
                ipa: note.fields?.[4] || ''
              }}
            />
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

{#if selectedWord}
  <HistoryDetailModal word={selectedWord} onClose={() => (selectedWord = null)} />
{/if}
