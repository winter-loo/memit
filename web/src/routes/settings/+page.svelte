<script>
  import { getTheme, setTheme } from '$lib/theme.svelte';

  let currentTheme = $derived(getTheme());
</script>

<div class="p-4 sm:p-8">
  <h1 class="text-3xl font-fredoka font-bold text-slate-800 dark:text-slate-100">Settings</h1>
  <p class="text-slate-500 dark:text-slate-400 font-medium mb-8">
    Manage your account and preferences
  </p>

  <section class="max-w-2xl space-y-6">
    <div class="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
      <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">palette</span>
        Appearance
      </h2>
      
      <div class="grid grid-cols-3 gap-4">
        <button
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 {currentTheme === 'light' ? 'border-primary bg-orange-50 dark:bg-orange-900/20 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'}"
          onclick={() => setTheme('light')}
        >
          <span class="material-symbols-outlined text-3xl mb-2">light_mode</span>
          <span class="font-medium">Light</span>
        </button>
        
        <button
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 {currentTheme === 'dark' ? 'border-primary bg-orange-50 dark:bg-orange-900/20 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'}"
          onclick={() => setTheme('dark')}
        >
          <span class="material-symbols-outlined text-3xl mb-2">dark_mode</span>
          <span class="font-medium">Dark</span>
        </button>
        
        <button
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 {currentTheme === 'system' ? 'border-primary bg-orange-50 dark:bg-orange-900/20 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'}"
          onclick={() => setTheme('system')}
        >
          <span class="material-symbols-outlined text-3xl mb-2">contrast</span>
          <span class="font-medium">System</span>
        </button>
      </div>
    </div>
  </section>
</div>
