<script>
  let { word } = $props();
</script>

<article class="p-6 card-3d-soft rounded-4xl bg-white dark:bg-card-dark group border-primary/30">
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-fredoka font-bold tracking-tight text-charcoal dark:text-white">
        {word}
      </h2>
      <div
        class="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-full border border-orange-100 dark:border-orange-800"
      >
        <div class="w-2 h-2 rounded-full bg-primary pulse-ring"></div>
        <span class="text-[10px] font-bold text-primary tracking-widest font-fredoka"
          >ANALYZING</span
        >
      </div>
    </div>
    <div class="w-3/4 h-5 skeleton-shimmer rounded-lg opacity-60"></div>
    <div class="w-1/2 h-5 skeleton-shimmer rounded-lg opacity-40"></div>
  </div>
</article>
