<script>
  import { goto } from '$app/navigation';

  function goSettings() {
    goto('/settings');
  }
</script>

<svelte:head>
  <title>Billing Canceled · Memit</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-midnight-navy">
  <div class="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card-dark p-8 shadow-sm text-center space-y-5">
    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/20">
      <span class="material-symbols-outlined text-4xl">payments</span>
    </div>
    <div class="space-y-2">
      <h1 class="text-3xl font-fredoka font-bold text-slate-900 dark:text-white">Checkout canceled</h1>
      <p class="text-slate-600 dark:text-slate-300">
        No payment was completed. You can return to settings and try again whenever you want.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      <button class="rounded-2xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90" onclick={goSettings}>
        Go to Settings
      </button>
      <a class="rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-3 font-semibold text-slate-700 dark:text-slate-200" href="/">
        Back Home
      </a>
    </div>
  </div>
</div>
