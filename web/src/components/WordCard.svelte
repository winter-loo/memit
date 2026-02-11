<script>
  let { word, onDelete } = $props();
</script>

<article class="p-6 card-3d-soft rounded-4xl bg-white dark:bg-card-dark group cursor-pointer">
  <div class="flex items-start justify-between">
    <div class="space-y-4 flex-grow">
      <div class="space-y-0.5">
        <div class="flex items-baseline gap-2">
          <h2
            class="text-2xl font-fredoka font-bold tracking-tight text-slate-800 dark:text-white"
          >
            {word.text}
          </h2>
          <span class="text-[10px] font-medium text-slate-400 shrink-0">{word.addedTime}</span>
        </div>
        {#if word.ipa}
          <p class="text-primary font-medium text-sm">{word.ipa}</p>
        {/if}
      </div>

      <div class="space-y-1">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
          Simple Definition
        </p>
        <p class="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
          {word.definition}
        </p>
      </div>

      {#if word.translation}
        <div
          class="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 border border-orange-100 dark:border-orange-800/30"
        >
          <p class="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
            Translation
          </p>
          <p class="text-primary font-fredoka font-bold text-lg leading-tight">
            {word.translation}
          </p>
        </div>
      {/if}
    </div>

    <div class="flex flex-col gap-2 ml-4">
      <button
        onclick={(e) => {
          e.stopPropagation();
          onDelete && onDelete();
        }}
        class="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 border-2 border-slate-100 dark:border-slate-700 hover:text-danger hover:border-danger/30 hover:bg-danger/5 transition-all cursor-pointer"
      >
        <span class="material-symbols-outlined text-2xl">delete</span>
      </button>
      <button
        onclick={(e) => {
          e.stopPropagation();
        }}
        class="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 border-2 border-slate-100 dark:border-slate-700 hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all cursor-pointer"
      >
        <span class="material-symbols-outlined text-2xl">volume_up</span>
      </button>
    </div>
  </div>
</article>
