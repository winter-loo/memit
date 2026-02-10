<script>
  let { secondsRemaining = 8, onGoHome = () => {} } = $props();

  function handleGoHome() {
    onGoHome();
  }
</script>

<div
  class="min-h-screen flex flex-col items-center justify-center p-6 font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100"
>
  <div class="w-full max-w-[520px] space-y-8">
    <div class="flex flex-col items-center text-center space-y-4">
      <div
        class="w-12 h-12 bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center shadow-sm"
      >
        <span class="material-symbols-outlined text-primary text-3xl fill-1">extension</span>
      </div>

      <div class="space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Signed in for the Chrome extension
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          You can return to the Memit extension and click <span class="font-semibold"
            >Save to Anki</span
          > again.
        </p>
      </div>
    </div>

    <div
      class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm"
    >
      <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        This page will redirect you to your Memit home in
        <span class="font-bold text-slate-900 dark:text-white">{secondsRemaining}s</span>.
      </p>

      <div class="flex items-center gap-3">
        <button
          onclick={handleGoHome}
          class="px-4 py-2 rounded-xl bg-primary text-white font-semibold shadow-sm active:scale-[0.98]"
        >
          Go to Memit
        </button>
        <p class="text-xs text-slate-500 dark:text-slate-400">You can also close this tab.</p>
      </div>
    </div>
  </div>
</div>
