<script lang="ts">
  import type { DictionaryResponse } from '../lib/explanation/types';
  import { MODEL_GROUPS } from '../lib/explanation/models';
  import ExplanationResult from './ExplanationResult.svelte';
  import LucideIcon from './LucideIcon.svelte';
  import Skeleton from './Skeleton.svelte';
  import { fly } from 'svelte/transition';

  interface Props {
    result?: DictionaryResponse;
    isLoading?: boolean;
    error?: string;
    isProviderError?: boolean;
    text?: string;
    modelId?: string;
    openRouterApiKey?: string;
    geminiApiKey?: string;
    responseTimeout?: number;
    onClose?: () => void;
    onSave?: () => void;
    onRetry?: (
      newModelId: string,
      apiKeys: { openRouter?: string; gemini?: string },
      newText?: string
    ) => void;
    isSaving?: boolean;
    isRetrying?: boolean;
    saveError?: string;
    isSaved?: boolean;
  }

  let {
    result,
    isLoading = false,
    error = '',
    isProviderError = false,
    text = '',
    modelId = '',
    openRouterApiKey = '',
    geminiApiKey = '',
    responseTimeout = 5,
    onClose,
    onSave,
    onRetry,
    isSaving = false,
    isRetrying = false,
    saveError = '',
    isSaved = false,
  }: Props = $props();

  /**
   * We use $state + $effect instead of $derived.by(() => modelId) for localModelId because:
   * 1. $derived is read-only and would break the 'bind:value' needed for the model selection dropdown.
   * 2. We need a "buffered state" that allows users to pick a model locally without immediately
   *    triggering a global storage update.
   * 3. The $effect ensures the local UI still stays in sync if the global settings change externally.
   * 4. Changes are only committed to global storage when the user clicks 'Stop and Retry'.
   */
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localModelId = $state('');
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localOpenRouterApiKey = $state('');
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localGeminiApiKey = $state('');
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localText = $state('');

  // Sync state if props change externally
  $effect(() => {
    localModelId = modelId;
  });
  $effect(() => {
    localOpenRouterApiKey = openRouterApiKey;
  });
  $effect(() => {
    localGeminiApiKey = geminiApiKey;
  });
  $effect(() => {
    localText = text;
  });

  let showFallback = $state(false);

  $effect(() => {
    if (isLoading && !isRetrying) {
      // Start a timer to show the fallback UI
      const timer = setTimeout(() => {
        showFallback = true;
      }, responseTimeout * 1000);

      return () => {
        clearTimeout(timer);
      };
    }
  });

  // Manage showFallback visibility
  $effect(() => {
    if (!isLoading && !isRetrying) {
      showFallback = false;
    }
    if (isRetrying) {
      showFallback = true;
    }
  });
</script>

<div class="modal-container" role="dialog" aria-modal="true">
  <header class="modal-header">
    <div class="brand">
      <div class="brand-icon">
        <LucideIcon name="languages" size={20} />
      </div>
      <h2 class="brand-name">memit</h2>
    </div>
    <div class="actions">
      <button
        class="action-btn"
        onclick={onSave}
        disabled={isSaving || isSaved || !result}
        title="Save to Anki"
      >
        <LucideIcon name={isSaved ? 'check' : 'save'} size={20} />
      </button>
      <button class="action-btn" title="Practice">
        <LucideIcon name="gamepad-2" size={20} />
      </button>
      <button class="action-btn close" onclick={onClose} title="Close">
        <LucideIcon name="x" size={20} />
      </button>
    </div>
  </header>

  <div class="modal-body custom-scrollbar">
    {#if isLoading}
      <div class="loading-container">
        <Skeleton {isRetrying} />
        {#if showFallback}
          <div class="loading-fallback" transition:fly={{ y: 50, duration: 400 }}>
            {#if isRetrying}
              <div class="retry-feedback">
                <LucideIcon name="refresh-cw" size={18} className="spinning" />
                Switching model...
              </div>
            {:else}
              <div class="model-selector compact">
                <label for="loading-model-select">Wait too long? Try another model:</label>
                <select id="loading-model-select" bind:value={localModelId}>
                  {#each MODEL_GROUPS as group (group.label)}
                    <optgroup label={group.label}>
                      {#each group.models as model (model.id)}
                        <option value={model.id}>{model.name}</option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
              </div>

              {#if localModelId.startsWith('openrouter:')}
                <div class="api-key-input compact">
                  <input
                    type="password"
                    id="loading-openrouter-key"
                    bind:value={localOpenRouterApiKey}
                    placeholder="OpenRouter API Key"
                  />
                </div>
              {/if}

              {#if localModelId.startsWith('gemini:')}
                <div class="api-key-input compact">
                  <input
                    type="password"
                    id="loading-gemini-key"
                    bind:value={localGeminiApiKey}
                    placeholder="Gemini API Key"
                  />
                </div>
              {/if}

              {#if onRetry}
                <button
                  class="retry-btn compact"
                  onclick={() =>
                    onRetry?.(localModelId, {
                      openRouter: localOpenRouterApiKey,
                      gemini: localGeminiApiKey,
                    })}
                >
                  <LucideIcon name="refresh-cw" size={16} />
                  Stop and Retry
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {:else if error}
      <div class="error-container">
        <div class="error-icon">
          <LucideIcon name="frown" size={32} />
        </div>
        <h3 class="error-title">Something went wrong</h3>

        {#if isProviderError}
          <div class="model-selector">
            <label for="error-model-select">Try another model:</label>
            <select id="error-model-select" bind:value={localModelId}>
              {#each MODEL_GROUPS as group (group.label)}
                <optgroup label={group.label}>
                  {#each group.models as model (model.id)}
                    <option value={model.id}>{model.name}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
          </div>

          {#if localModelId.startsWith('openrouter:')}
            <div class="api-key-input">
              <label for="modal-openrouter-key">OpenRouter API Key:</label>
              <input
                type="password"
                id="modal-openrouter-key"
                bind:value={localOpenRouterApiKey}
                placeholder="sk-or-v1-..."
              />
            </div>
          {/if}

          {#if localModelId.startsWith('gemini:')}
            <div class="api-key-input">
              <label for="modal-gemini-key">Gemini API Key:</label>
              <input
                type="password"
                id="modal-gemini-key"
                bind:value={localGeminiApiKey}
                placeholder="AIzaSy..."
              />
            </div>
          {/if}

          {#if onRetry}
            <button
              class="retry-btn"
              onclick={() =>
                onRetry?.(localModelId, {
                  openRouter: localOpenRouterApiKey,
                  gemini: localGeminiApiKey,
                })}
            >
              <LucideIcon name="refresh-cw" size={18} />
              Try Again
            </button>
          {/if}
        {:else if error.toLowerCase().includes('too long')}
          <div class="text-shortener">
            <label for="error-text-shorten">Shorten your selection:</label>
            <textarea
              id="error-text-shorten"
              bind:value={localText}
              placeholder="Edit your selection here..."
              rows="4"
            ></textarea>
            {#if onRetry}
              <button
                class="retry-btn"
                onclick={() =>
                  onRetry?.(
                    localModelId,
                    {
                      openRouter: localOpenRouterApiKey,
                      gemini: localGeminiApiKey,
                    },
                    localText
                  )}
              >
                <LucideIcon name="refresh-cw" size={18} />
                Try Again with New Text
              </button>
            {/if}
          </div>
        {/if}

        <p class="error-message">{error}</p>
      </div>
    {:else if result}
      <ExplanationResult {result} {saveError} />
    {/if}
  </div>
</div>

<style>
  .modal-container {
    background: var(--bg-dark);
    width: 440px;
    height: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    color: var(--text-main);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-header);
    z-index: 20;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .brand-icon {
    background: rgba(242, 139, 13, 0.1);
    color: var(--primary-color);
    padding: 0.4rem;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-icon :global(.lucide-icon) {
    width: 20px;
    height: 20px;
  }

  .brand-name {
    font-size: 1rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-main);
    opacity: 0.8;
    margin: 0;
  }

  .actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .action-btn {
    background: var(--card-bg);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-deep);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.close:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: var(--error-color);
    color: var(--error-color);
  }

  .action-btn :global(.lucide-icon) {
    width: 20px;
    height: 20px;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .loading-fallback {
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    background: var(--bg-dark);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .retry-feedback {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--primary-color);
    font-size: 14px;
    font-weight: 600;
    padding: var(--spacing-sm);
  }

  :global(.spinning) {
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: start;
    justify-content: start;
    height: 100%;
    padding: var(--spacing-xl);
    gap: var(--spacing-md);
    text-align: center;
  }

  .error-icon {
    width: 32px;
    height: 32px;
    background: rgba(239, 68, 68, 0.1);
    color: var(--error-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--spacing-sm);
  }

  .error-icon :global(.lucide-icon) {
    width: 32px;
    height: 32px;
  }

  .error-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-main);
    margin: 0;
  }

  .error-message {
    white-space: pre-wrap;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
    max-width: 320px;
  }

  .model-selector,
  .api-key-input,
  .text-shortener {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    max-width: 280px;
    margin-top: var(--spacing-md);
    text-align: left;
  }

  .text-shortener {
    max-width: 320px;
  }

  .model-selector.compact,
  .api-key-input.compact {
    margin-top: 0;
    gap: 4px;
  }

  .model-selector label,
  .api-key-input label,
  .text-shortener label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .model-selector select,
  .api-key-input input,
  .text-shortener textarea {
    background: var(--card-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    padding: var(--spacing-sm);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
  }

  .text-shortener textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .model-selector.compact select,
  .api-key-input.compact input {
    padding: 6px 10px;
    font-size: 13px;
  }

  .retry-btn {
    margin-top: var(--spacing-sm);
    background: var(--primary-color);
    color: white;
    border: none;
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--radius-md);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    transition: transform var(--transition-fast);
    width: 100%;
    max-width: 280px;
    justify-content: center;
  }

  .retry-btn.compact {
    margin-top: 4px;
    padding: 6px 12px;
    font-size: 13px;
  }

  .retry-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  .retry-btn :global(.lucide-icon) {
    width: 18px;
    height: 18px;
  }

  /* Custom scrollbar for the modal body */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: var(--bg-dark);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 10px;
  }
</style>
