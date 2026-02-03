<script lang="ts">
  import { RefreshCw } from '@lucide/svelte';
  import { MODEL_GROUPS } from '../lib/explanation/models';

  interface Props {
    modelId: string;
    openRouterApiKey: string;
    geminiApiKey: string;
    onRetry?: (modelId: string, apiKeys: { openRouter?: string; gemini?: string }) => void;
    label?: string;
    idPrefix: string;
    buttonText?: string;
    compact?: boolean;
    disabledModels?: string[];
    badge?: import('svelte').Snippet;
  }

  let {
    modelId = $bindable(),
    openRouterApiKey = $bindable(),
    geminiApiKey = $bindable(),
    onRetry,
    label = 'Try another model:',
    idPrefix,
    buttonText = 'Try Again',
    compact = true,
    disabledModels = [],
    badge,
  }: Props = $props();

  const isCurrentModelPending = $derived(disabledModels.includes(modelId));
</script>

<div class="model-selector" class:compact>
  <label for="{idPrefix}-model-select">{label}</label>
  <select id="{idPrefix}-model-select" bind:value={modelId}>
    {#each MODEL_GROUPS as group (group.label)}
      <optgroup label={group.label}>
        {#each group.models as model (model.id)}
          <option value={model.id} disabled={disabledModels.includes(model.id)}>
            {model.name}
            {disabledModels.includes(model.id) ? '(Pending)' : ''}
          </option>
        {/each}
      </optgroup>
    {/each}
  </select>
</div>

{#if modelId.startsWith('openrouter:')}
  <div class="api-key-input" class:compact>
    {#if !compact}
      <label for="{idPrefix}-openrouter-key">OpenRouter API Key:</label>
    {/if}
    <input
      type="password"
      id="{idPrefix}-openrouter-key"
      bind:value={openRouterApiKey}
      placeholder={compact ? 'OpenRouter API Key' : 'sk-or-v1-...'}
    />
  </div>
{/if}

{#if modelId.startsWith('gemini:')}
  <div class="api-key-input" class:compact>
    {#if !compact}
      <label for="{idPrefix}-gemini-key">Gemini API Key:</label>
    {/if}
    <input
      type="password"
      id="{idPrefix}-gemini-key"
      bind:value={geminiApiKey}
      placeholder={compact ? 'Gemini API Key' : 'AIzaSy...'}
    />
  </div>
{/if}

{#if onRetry}
  <button
    class="retry-btn"
    class:compact
    disabled={isCurrentModelPending}
    onclick={() =>
      onRetry(modelId, {
        openRouter: openRouterApiKey,
        gemini: geminiApiKey,
      })}
  >
    <div class="btn-content">
      <RefreshCw size={compact ? 16 : 18} />
      {isCurrentModelPending ? 'Request Pending...' : buttonText}
    </div>
    {#if badge}
      {@render badge()}
    {/if}
  </button>
{/if}

<style>
  .btn-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .retry-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--text-muted);
  }

  .model-selector,
  .api-key-input {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    max-width: 280px;
    margin-top: var(--spacing-md);
    text-align: left;
  }

  .model-selector.compact,
  .api-key-input.compact {
    margin-top: 0;
    gap: 4px;
  }

  .model-selector label,
  .api-key-input label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .model-selector select,
  .api-key-input input {
    background: var(--card-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    padding: var(--spacing-sm);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
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
    justify-content: space-between;
    gap: var(--spacing-sm);
    transition: transform var(--transition-fast);
    width: 100%;
    max-width: 280px;
    font-size: 14px;
    cursor: pointer;
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
</style>
