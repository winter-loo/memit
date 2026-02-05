<script lang="ts">
  import { onMount } from 'svelte';
  import { MODEL_GROUPS } from './lib/explanation/models';
  import { Check, Languages, Loader2, XCircle } from '@lucide/svelte';
  import { AnkiClient } from './lib/anki/client';

  interface Settings {
    ankiAutoSave: boolean;
    theme: string;
    preferredLanguage: string;
    modelId: string;
    openRouterApiKey: string;
    geminiApiKey: string;
    ankiBackendUrl: string;
    responseTimeout: number;
  }

  let settings = $state<Settings>({
    ankiAutoSave: false,
    theme: 'light',
    preferredLanguage: 'zh-CN',
    modelId: 'memcool:gemini-2.5-flash-lite',
    openRouterApiKey: '',
    geminiApiKey: '',
    ankiBackendUrl: 'https://memit.ldd.cool',
    responseTimeout: 5,
  });

  let saved = $state(false);
  let testingAuth = $state(false);
  let authStatus = $state<{ ok: boolean; message: string } | null>(null);

  const anki = new AnkiClient();

  onMount(() => {
    chrome.storage.sync.get(
      [
        'ankiAutoSave',
        'theme',
        'preferredLanguage',
        'modelId',
        'openRouterApiKey',
        'geminiApiKey',
        'ankiBackendUrl',
        'responseTimeout',
      ],
      (result: Partial<Settings>) => {
        settings.ankiAutoSave = result.ankiAutoSave ?? false;
        settings.theme = result.theme ?? 'light';
        settings.preferredLanguage = result.preferredLanguage ?? 'zh-CN';
        settings.modelId = result.modelId ?? 'memcool:gemini-2.5-flash-lite';
        settings.openRouterApiKey = result.openRouterApiKey ?? '';
        settings.geminiApiKey = result.geminiApiKey ?? '';
        settings.ankiBackendUrl = result.ankiBackendUrl ?? 'https://memit.ldd.cool';
        settings.responseTimeout = result.responseTimeout ?? 5;
      }
    );

    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync') {
        if (changes.modelId) settings.modelId = changes.modelId.newValue as string;
        if (changes.ankiAutoSave) settings.ankiAutoSave = changes.ankiAutoSave.newValue as boolean;
        if (changes.theme) settings.theme = changes.theme.newValue as string;
        if (changes.preferredLanguage)
          settings.preferredLanguage = changes.preferredLanguage.newValue as string;
        if (changes.openRouterApiKey)
          settings.openRouterApiKey = changes.openRouterApiKey.newValue as string;
        if (changes.geminiApiKey) settings.geminiApiKey = changes.geminiApiKey.newValue as string;
        if (changes.ankiBackendUrl) settings.ankiBackendUrl = changes.ankiBackendUrl.newValue as string;
        if (changes.responseTimeout)
          settings.responseTimeout = changes.responseTimeout.newValue as number;
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  });

  async function saveSettings() {
    await chrome.storage.sync.set(settings);
    saved = true;
    setTimeout(() => {
      saved = false;
    }, 2000);
  }

  async function testAuth() {
    testingAuth = true;
    authStatus = null;
    anki.setBaseUrl(settings.ankiBackendUrl);

    try {
      const result = await chrome.storage.local.get(['ankiAuthToken']);
      const token = result.ankiAuthToken;

      if (!token) {
        authStatus = { ok: false, message: 'No local token found. Please sign in.' };
        return;
      }

      const info = await anki.whoami(token);
      authStatus = { ok: true, message: `Connected as ${info.user_id}` };
    } catch (e: any) {
      authStatus = { ok: false, message: e?.message || 'Connection failed' };
    } finally {
      testingAuth = false;
    }
  }

  $effect(() => {
    if (settings.theme === 'light') {
      document.body.classList.add('memit-light');
    } else {
      document.body.classList.remove('memit-light');
    }
  });
</script>

<div class="settings-layout">
  <header>
    <div class="brand">
      <div class="brand-icon">
        <Languages size={22} />
      </div>
      <h1 class="brand-name">memit settings</h1>
    </div>
  </header>

  <main>
    <section class="settings-card">
      <h2 class="section-title">General Preferences</h2>

      <div class="setting-item">
        <div class="setting-info">
          <label for="theme">Appearance</label>
          <p class="description">Choose between a dark academic or clean light theme.</p>
        </div>
        <div class="setting-action">
          <select id="theme" bind:value={settings.theme}>
            <option value="dark">Dark (Orange Memory)</option>
            <option value="light">Light (Clean)</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="auto-save">Auto-save to Anki</label>
          <p class="description">Automatically create a note in Anki after every lookup.</p>
        </div>
        <div class="setting-action">
          <input type="checkbox" id="auto-save" bind:checked={settings.ankiAutoSave} />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="language">Target Language</label>
          <p class="description">The language to provide translations in.</p>
        </div>
        <div class="setting-action">
          <select id="language" bind:value={settings.preferredLanguage}>
            <option value="zh-CN">Chinese (Simplified)</option>
            <option value="zh-TW">Chinese (Traditional)</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="timeout">Response Timeout (seconds)</label>
          <p class="description">How long to wait before showing the 'Stop and Retry' option.</p>
        </div>
        <div class="setting-action">
          <input
            type="number"
            id="timeout"
            bind:value={settings.responseTimeout}
            min="1"
            max="30"
            step="1"
            style="width: 80px;"
          />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="anki-backend-url">Backend Service URL</label>
          <p class="description">The URL of your anki-service (e.g., <a href="https://memit.ldd.cool" target="_blank">https://memit.ldd.cool</a>).</p>
        </div>
        <div class="setting-action">
          <input
            type="text"
            id="anki-backend-url"
            bind:value={settings.ankiBackendUrl}
            placeholder="https://memit.ldd.cool"
          />
          <button class="test-btn" onclick={testAuth} disabled={testingAuth}>
            {#if testingAuth}
              <Loader2 size={16} class="spinner" />
              Checking...
            {:else}
              Test Auth
            {/if}
          </button>
        </div>
      </div>

      {#if authStatus}
        <div class="status-msg {authStatus.ok ? 'success' : 'error'}">
          {#if !authStatus.ok}
            <XCircle size={14} />
          {/if}
          {authStatus.message}
        </div>
      {/if}

      <div class="setting-item">
        <div class="setting-info">
          <label for="model">AI Model</label>
          <p class="description">Select the model to power your explanations.</p>
        </div>
        <div class="setting-action">
          <select id="model" bind:value={settings.modelId}>
            {#each MODEL_GROUPS as group (group.label)}
              <optgroup label={group.label}>
                {#each group.models as model (model.id)}
                  <option value={model.id}>{model.name}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        </div>
      </div>

      {#if settings.modelId.startsWith('openrouter:')}
        <div class="setting-item">
          <div class="setting-info">
            <label for="openrouter-api-key">OpenRouter API Key</label>
            <p class="description">
              Your personal API key from <a href="https://openrouter.ai/keys" target="_blank"
                >openrouter.ai</a
              >. Stored locally in your browser.
            </p>
          </div>
          <div class="setting-action">
            <input
              type="password"
              id="openrouter-api-key"
              bind:value={settings.openRouterApiKey}
              placeholder="sk-or-v1-..."
            />
          </div>
        </div>
      {/if}

      {#if settings.modelId.startsWith('gemini:')}
        <div class="setting-item">
          <div class="setting-info">
            <label for="gemini-api-key">Gemini API Key</label>
            <p class="description">
              Your personal API key from <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank">Google AI Studio</a
              >. Stored locally in your browser.
            </p>
          </div>
          <div class="setting-action">
            <input
              type="password"
              id="gemini-api-key"
              bind:value={settings.geminiApiKey}
              placeholder="AIzaSy..."
            />
          </div>
        </div>
      {/if}

      <div class="footer">
        <button class="save-btn" onclick={saveSettings}>
          {#if saved}
            <Check size={18} />
            Saved!
          {:else}
            Save Changes
          {/if}
        </button>
      </div>
    </section>
  </main>
</div>

<style>
  .settings-layout {
    min-height: 100vh;
    background-color: var(--bg-deep);
    color: var(--text-main);
    display: flex;
    flex-direction: column;
  }

  header {
    background: var(--bg-dark);
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  .brand-icon {
    background: rgba(242, 139, 13, 0.1);
    color: var(--primary-color);
    padding: 0.6rem;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-name {
    font-size: 1.25rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0;
  }

  main {
    flex: 1;
    padding: 3rem 2rem;
    display: flex;
    justify-content: center;
  }

  .settings-card {
    background: var(--bg-dark);
    width: 100%;
    max-width: 800px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .section-title {
    font-size: 0.9rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--primary-color);
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.75rem;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .setting-info {
    flex: 1;
  }

  label {
    display: block;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .description {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .setting-action {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .test-btn {
    background: var(--card-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all var(--transition-fast);
  }

  .test-btn:hover:not(:disabled) {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  .test-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status-msg {
    margin-top: -1.5rem;
    font-size: 0.85rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-msg.success {
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .status-msg.error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  :global(.spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  select {
    background: var(--card-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.9rem;
  }

  input[type='checkbox'] {
    width: 20px;
    height: 20px;
    accent-color: var(--primary-color);
    cursor: pointer;
  }

  .footer {
    margin-top: 1rem;
    display: flex;
    justify-content: flex-end;
  }

  .save-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: var(--radius-md);
    font-weight: 700;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    transition: all var(--transition-fast);
  }

  .save-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .save-btn:active {
    transform: translateY(0);
  }
</style>
