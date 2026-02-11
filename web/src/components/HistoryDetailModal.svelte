<script>
  let { word, onClose } = $props();
  let activeTab = $state('explanation'); // explanation, examples, origin
</script>

<div
  class="fixed inset-0 bg-slate-900/60 backdrop-blur-[4px] z-50 flex items-center justify-center p-4"
>
  <!-- Card Container -->
  <div
    class="bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full max-w-[450px] max-h-[90vh] overflow-hidden border border-orange-50 relative flex flex-col transform perspective-[2000px] rotate-x-1 -translate-y-[5px]"
  >
    <!-- Close Button (Fixed relative to Card) -->
    <div class="absolute top-5 right-5 z-50">
      <button
        onclick={onClose}
        class="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 transition-colors border border-slate-200 shadow-sm cursor-pointer"
      >
        <span class="material-symbols-outlined text-xl">close</span>
      </button>
    </div>

    <!-- Scrollable Area -->
    <div class="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
      <!-- 1. Header (Word + IPA) - Scrolls away -->
      <div class="px-6 pt-10 pb-2">
        <h2 class="text-4xl font-fredoka font-bold text-slate-800 tracking-tight mb-2">
          {word.text}
        </h2>
        <div class="flex items-center gap-3">
          {#if word.ipa}
            <p class="text-lg text-primary font-medium">{word.ipa}</p>
          {/if}
          <button
            class="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all cursor-pointer"
          >
            <span class="material-symbols-outlined text-lg">volume_up</span>
          </button>
        </div>
      </div>

      <!-- 2. Sticky Translation Block -->
      <div class="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 py-4 border-b border-slate-50 shadow-sm">
        <div class="bg-orange-50 border border-orange-200 rounded-3xl p-5 flex flex-col gap-4">
          <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Simple Definition
            </p>
            <p class="text-slate-700 text-sm font-medium leading-relaxed">
              {word.definition}
            </p>
          </div>
          <div class="pt-4 border-t border-orange-200/50">
            <p class="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">
              Translation
            </p>
            <p class="text-2xl font-fredoka font-bold text-primary leading-tight">
              {word.translation}
            </p>
          </div>
        </div>
      </div>

      <!-- 3. Tab Content -->
      <div class="px-6 py-6 pb-10">
        {#if activeTab === 'explanation'}
          <section class="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h4
              class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
              Detailed Explanation
            </h4>
            <div
              class="text-slate-600 text-sm leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100"
            >
              {word.detailed_explanation || 'No detailed explanation available.'}
            </div>
          </section>
        {:else if activeTab === 'examples'}
          <section class="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h4
              class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
              Examples
            </h4>
            <div class="space-y-3">
              {#if word.examples && word.examples.length > 0}
                {#each word.examples as example, i}
                  <div class="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed">
                    "{example}"
                  </div>
                {/each}
              {:else}
                <div class="text-slate-400 text-sm italic p-4">No examples available.</div>
              {/if}
            </div>
          </section>
        {:else if activeTab === 'origin'}
          <section class="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h4
              class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Etymology
            </h4>
            <div
              class="text-slate-600 text-sm leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100 italic"
            >
              {word.etymology || 'No origin information available.'}
            </div>
          </section>
        {/if}
      </div>
    </div>

    <!-- 4. Fixed Footer Tabs -->
    <div class="mt-auto border-t border-slate-100 bg-white px-4 flex shrink-0 z-50">
      <button
        onclick={() => activeTab = 'explanation'}
        class="flex-1 py-4 text-[10px] font-bold tracking-widest text-center transition-colors {activeTab === 'explanation' ? 'text-primary relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-8 after:h-1 after:bg-primary after:rounded-t-full' : 'text-slate-400 hover:text-primary'}"
      >
        EXPLANATION
      </button>
      <button
        onclick={() => activeTab = 'examples'}
        class="flex-1 py-4 text-[10px] font-bold tracking-widest text-center transition-colors {activeTab === 'examples' ? 'text-primary relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-8 after:h-1 after:bg-primary after:rounded-t-full' : 'text-slate-400 hover:text-primary'}"
      >
        EXAMPLES
      </button>
      <button
        onclick={() => activeTab = 'origin'}
        class="flex-1 py-4 text-[10px] font-bold tracking-widest text-center transition-colors {activeTab === 'origin' ? 'text-primary relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-8 after:h-1 after:bg-primary after:rounded-t-full' : 'text-slate-400 hover:text-primary'}"
      >
        ORIGIN
      </button>
    </div>
  </div>
</div>
