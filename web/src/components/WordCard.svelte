<script>
  let { word, onDelete } = $props();

  let isPhrase = $derived((word.text || '').trim().split(/\s+/).length >= 2);
</script>

<article class="p-6 card-3d-soft rounded-4xl bg-white dark:bg-card-dark group cursor-pointer">
  <div class="flex items-start justify-between">
    <div class="space-y-4 flex-grow">
      <div class="space-y-0.5">
        <h2
          class="text-2xl font-fredoka font-bold tracking-tight text-slate-800 dark:text-white leading-tight break-words"
        >
          {word.text}
          <span
            class="text-[12px] font-medium text-slate-400 dark:text-text-muted align-middle ml-1.5 whitespace-nowrap"
            >{word.addedTime}</span
          >
        </h2>
        {#if word.ipa && !isPhrase}
          <p class="text-primary font-medium text-sm">{word.ipa}</p>
        {/if}
      </div>

      {#if word.translation}
        <div
          class="bg-orange-50 dark:bg-midnight-navy/40 rounded-2xl p-4 border border-orange-100 dark:border-white/5"
        >
          <p class="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
            Translation
          </p>
          <p class="text-primary font-fredoka font-bold text-lg leading-tight">
            {word.translation}
          </p>
        </div>
      {/if}

      <div class="space-y-1">
        <p
          class="text-[10px] font-bold text-slate-400 dark:text-text-muted uppercase tracking-tight"
        >
          Simple Definition
        </p>
        <p class="text-slate-600 dark:text-text-main font-medium leading-relaxed">
          {word.definition}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2 ml-4">
      <button
        onclick={(e) => {
          e.stopPropagation();
          onDelete && onDelete();
        }}
        class="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 dark:text-text-muted border-2 border-slate-100 dark:border-white/10 hover:text-danger hover:border-danger/30 hover:bg-danger/5 transition-all cursor-pointer"
      >
        <span class="material-symbols-outlined text-2xl">delete</span>
      </button>
      <button
        onclick={(e) => {
          e.stopPropagation();
        }}
        class="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 dark:text-text-muted border-2 border-slate-100 dark:border-white/10 hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all cursor-pointer"
      >
        <span class="material-symbols-outlined text-2xl">volume_up</span>
      </button>
    </div>
  </div>
</article>
