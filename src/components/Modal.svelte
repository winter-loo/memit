<script lang="ts">
  import type { DictionaryResponse } from '../lib/explanation/types';
  import { MODEL_GROUPS } from '../lib/explanation/models';
  import ExplanationResult from './ExplanationResult.svelte';
  import Skeleton from './Skeleton.svelte';
  import {
    Check,
    CircleCheck,
    ChevronLeft,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    Circle,
    Frown,
    Gamepad2,
    Languages,
    RefreshCw,
    Save,
    X,
    CircleX,
  } from '@lucide/svelte';
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
    responses?: {
      modelId: string;
      status: 'success' | 'error';
      result?: DictionaryResponse;
      error?: string;
      responseTimeMs: number;
      receivedAt: number;
    }[];
    activeResponseIndex?: number;
    pendingResponses?: number;
    onSelectResponse?: (index: number) => void;
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
    responses = [],
    activeResponseIndex = 0,
    pendingResponses = 0,
    onSelectResponse,
  }: Props = $props();

  function formatResponseTime(timeMs: number) {
    if (!timeMs || timeMs < 0) return '';
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(1)}s`;
  }

  function formatProvider(value: string) {
    if (!value) return '';
    return value
      .split('-')
      .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
      .join(' ');
  }

  function getModelParts(modelId: string) {
    const [prefix, rest] = modelId.split(':');
    if (!rest) {
      return { provider: formatProvider(prefix ?? ''), model: '' };
    }
    if (rest.includes('/')) {
      const [providerRaw, ...restParts] = rest.split('/');
      return {
        provider: formatProvider(providerRaw ?? prefix ?? ''),
        model: restParts.join('/'),
      };
    }
    return { provider: formatProvider(prefix ?? ''), model: rest };
  }

  function truncateModelPartsByChars(
    provider: string,
    model: string,
    maxChars: number
  ) {
    const providerText = provider.trim();
    const modelText = model.trim();
    const sep = modelText ? ' / ' : '';
    const fullLabel = `${providerText}${sep}${modelText}`;

    if (fullLabel.length <= maxChars) {
      return {
        providerText,
        modelText,
        truncated: false,
        fullLabel,
      };
    }

    if (providerText.length + sep.length >= maxChars) {
      const truncatedProvider = providerText.slice(0, Math.max(maxChars, 0)).trimEnd();
      return {
        providerText: `${truncatedProvider}...`,
        modelText: '',
        truncated: true,
        fullLabel,
      };
    }

    const remainingForModel = Math.max(
      maxChars - providerText.length - sep.length,
      0
    );
    const truncatedModel =
      modelText.length > remainingForModel
        ? `${modelText.slice(0, remainingForModel).trimEnd()}...`
        : modelText;

    return {
      providerText,
      modelText: truncatedModel,
      truncated: truncatedModel !== modelText,
      fullLabel,
    };
  }

  const activeResponse = $derived(responses[activeResponseIndex]);
  const totalResponses = $derived(responses.length + pendingResponses);

  let showResponseMenu = $state(false);
  let showResponseBar = $state(true);

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

  $effect(() => {
    if (responses.length === 0) {
      showResponseMenu = false;
      showResponseBar = true;
    }
  });
</script>

<div class="modal-container" role="dialog" aria-modal="true">
  <header class="modal-header">
    <div class="brand">
      <div class="brand-icon">
        <Languages size={20} />
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
        {#if isSaved}
          <Check size={20} />
        {:else}
          <Save size={20} />
        {/if}
      </button>
      <button class="action-btn" title="Practice">
        <Gamepad2 size={20} />
      </button>
      <button class="action-btn close" onclick={onClose} title="Close">
        <X size={20} />
      </button>
    </div>
  </header>

  <div class="modal-body custom-scrollbar">
    {#if isLoading && responses.length === 0}
      <div class="loading-container">
        <Skeleton {isRetrying} />
        {#if showFallback}
          <div class="loading-fallback" transition:fly={{ y: 50, duration: 400 }}>
            {#if isRetrying}
              <div class="retry-feedback">
                <RefreshCw size={18} class="spinning" />
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
                  <RefreshCw size={16} />
                  Stop and Retry
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {:else if error && responses.length === 0}
      <div class="error-container">
        <div class="error-icon">
          <Frown size={32} />
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
              <RefreshCw size={18} />
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
                <RefreshCw size={18} />
                Try Again with New Text
              </button>
            {/if}
          </div>
        {/if}

        <p class="error-message">{error}</p>
      </div>
    {:else if responses.length > 0}
      {#if showResponseBar && responses.length > 1}
        <div class="response-status-wrapper">
          <div class="response-status-bar">
            <div class="response-status-left">
              <div class="response-badge">{activeResponseIndex + 1}/{totalResponses}</div>
              {#if activeResponse}
                {@const parts = getModelParts(activeResponse.modelId)}
                {@const truncatedParts = truncateModelPartsByChars(parts.provider, parts.model, 22)}
                <div class="response-model-line">
                  <span
                    class="response-model-provider"
                    title={truncatedParts.truncated ? truncatedParts.fullLabel : undefined}
                  >
                    {truncatedParts.providerText}
                  </span>
                  {#if truncatedParts.modelText}
                    <span class="response-model-sep">/</span>
                    <span class="response-model-name">{truncatedParts.modelText}</span>
                  {/if}
                </div>
              {/if}
            </div>
            {#if activeResponse?.responseTimeMs}
              <div class="response-status-time">
                {formatResponseTime(activeResponse.responseTimeMs)}
              </div>
            {/if}
            <div class="response-status-right">
              <button
                class="response-icon-btn"
                onclick={() => onSelectResponse?.(activeResponseIndex - 1)}
                disabled={activeResponseIndex === 0}
                aria-label="Previous response"
                title="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                class="response-icon-btn"
                onclick={() => onSelectResponse?.(activeResponseIndex + 1)}
                disabled={activeResponseIndex >= responses.length - 1}
                aria-label="Next response"
                title="Next"
              >
                <ChevronRight size={16} />
              </button>
              <button
                class={`response-icon-btn response-toggle ${showResponseMenu ? 'is-open' : ''}`}
                onclick={() => (showResponseMenu = !showResponseMenu)}
                aria-label={showResponseMenu ? 'Collapse' : 'Expand'}
                title={showResponseMenu ? 'Collapse' : 'Expand'}
              >
                {#if showResponseMenu}
                  <ChevronsDownUp size={15} />
                {:else}
                  <ChevronsUpDown size={15} />
                {/if}
              </button>
              <button
                class="response-icon-btn response-close"
                onclick={() => {
                  showResponseMenu = false;
                  showResponseBar = false;
                }}
                aria-label="Close status"
                title="Close Status"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {#if showResponseMenu && responses.length > 1}
            <div class="response-menu custom-scrollbar">
              {#each responses as response, index (response.receivedAt)}
                {@const parts = getModelParts(response.modelId)}
                <button
                  class={`response-menu-item ${index === activeResponseIndex ? 'is-active' : ''}`}
                  onclick={() => {
                    onSelectResponse?.(index);
                    showResponseMenu = false;
                  }}
                >
                  <div class="response-menu-left">
                    <span class="response-menu-badge">{index + 1}/{totalResponses}</span>
                    <div class="response-menu-model">
                      <span class="response-model-provider">{parts.provider}</span>
                      <span class="response-model-sep">/</span>
                      <span class="response-model-name">{parts.model}</span>
                    </div>
                  </div>
                  <div class="response-menu-right">
                    <span class="response-menu-time">{formatResponseTime(response.responseTimeMs)}</span>
                    {#if response.status === 'error'}
                      <CircleX size={16} class="response-status-icon is-error" fill="currentColor" />
                    {:else if index === activeResponseIndex}
                      <CircleCheck
                        size={16}
                        class="response-status-icon is-active"
                        fill="var(--primary-color)"
                        color="#ffffff"
                      />
                    {:else}
                      <Circle
                        size={16}
                        class="response-status-icon"
                        fill="#e5e7eb"
                        color="#e5e7eb"
                      />
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if activeResponse?.status === 'error'}
        <div class="response-error">
          <div class="response-error-title">
            <CircleX size={16} />
            Request failed
          </div>
          <p class="response-error-message">{activeResponse.error}</p>
        </div>
      {:else if activeResponse?.result}
        <ExplanationResult result={activeResponse.result} {saveError} />
      {:else if result}
        <ExplanationResult {result} {saveError} />
      {/if}
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

  .response-status-wrapper {
    position: relative;
    z-index: 20;
  }

  .response-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 16px;
    border-bottom: 1px solid rgba(229, 231, 235, 0.6);
    backdrop-filter: blur(8px);
    background-color: rgba(255, 255, 255, 0.9);
    position: relative;
  }

  .response-status-left {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
  }

  .response-badge {
    font-size: 10px;
    font-weight: 700;
    color: rgba(108, 117, 125, 0.8);
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .response-model-line {
    display: flex;
    align-items: center;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .response-model-provider {
    font-weight: 700;
    color: #333333;
  }

  .response-model-sep {
    color: #6c757d;
    padding: 0 2px;
  }

  .response-model-name {
    font-weight: 500;
    color: #6c757d;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .response-status-time {
    font-size: 11px;
    font-weight: 900;
    color: #ff8c00;
    background: rgba(255, 140, 0, 0.05);
    padding: 2px 8px;
    border-radius: 9999px;
    border: 1px solid rgba(255, 140, 0, 0.1);
    letter-spacing: -0.02em;
  }

  .response-status-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .response-icon-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6c757d;
    border-radius: 6px;
    background: transparent;
    border: none;
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .response-icon-btn:hover:not(:disabled) {
    color: #ff8c00;
    background: rgba(255, 140, 0, 0.05);
  }

  .response-icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .response-icon-btn.response-toggle.is-open {
    color: #ff8c00;
    background: rgba(255, 140, 0, 0.1);
  }

  .response-icon-btn.response-close:hover:not(:disabled) {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }

  .response-menu {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    max-height: 400px;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.95);
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(12px);
    z-index: 20;
  }

  .response-menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border: none;
    border-bottom: 1px solid #f3f4f6;
    background: transparent;
    color: #333333;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .response-menu-item:hover {
    background: #f9fafb;
  }

  .response-menu-item.is-active {
    background: var(--bg-dark);
  }

  .response-menu-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .response-menu-badge {
    font-size: 10px;
    font-weight: 700;
    color: rgba(108, 117, 125, 0.6);
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .response-menu-item.is-active .response-menu-badge {
    color: #ff8c00;
    background: #ffffff;
    border: 1px solid rgba(255, 140, 0, 0.2);
  }

  .response-menu-model {
    display: flex;
    align-items: center;
    font-size: 12px;
    gap: 2px;
  }

  .response-menu-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .response-menu-time {
    font-size: 11px;
    font-weight: 700;
    color: #ff8c00;
  }

  .response-status-icon {
    color: #d1d5db;
  }

  .response-status-icon.is-active {
    color: #ff8c00;
  }

  .response-status-icon.is-error {
    color: #ef4444;
  }

  .response-menu-item:hover .response-status-icon:not(.is-active):not(.is-error) {
    color: #6c757d;
  }

  .response-error {
    margin: var(--spacing-lg);
    border: 1px solid #fee2e2;
    background: #fef2f2;
    color: #b91c1c;
    border-radius: var(--radius-lg);
    padding: var(--spacing-md);
  }

  .response-error-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-weight: 700;
    font-size: 13px;
    margin-bottom: var(--spacing-xs);
  }

  .response-error-message {
    font-size: 12px;
    margin: 0;
    line-height: 1.5;
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
