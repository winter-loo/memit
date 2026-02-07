<script>
  let { word } = $props();
</script>

<div
  class="bg-white dark:bg-card-dark border-2 border-orange-100 dark:border-slate-700 rounded-[20px] p-5 hover:border-primary transition-all cursor-pointer flex flex-col h-full"
>
  <div class="flex items-start justify-between mb-1">
    <h3 class="text-xl font-fredoka font-bold text-slate-800 dark:text-white">{word.text}</h3>
    {#if word.pos}
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1"
        >{word.pos}</span
      >
    {/if}
  </div>
  {#if word.ipa}
    <p class="text-primary font-medium text-sm mb-3">{word.ipa}</p>
  {/if}
  <div class="mb-4 flex-grow">
    <p class="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">
      Simple Definition
    </p>
    <p class="text-slate-600 dark:text-slate-400 text-sm leading-snug">{word.definition}</p>
  </div>
  <div
    class="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 border border-orange-100 dark:border-orange-800 mt-auto"
  >
    <span class="text-[10px] font-bold text-primary uppercase tracking-wider block mb-0.5"
      >Translation</span
    >
    <p class="font-fredoka font-bold text-primary text-base leading-tight">{word.translation}</p>
  </div>
</div>
