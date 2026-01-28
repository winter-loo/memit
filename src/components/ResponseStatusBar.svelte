<script lang="ts">
  import {
    ChevronLeft,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    Circle,
    CircleCheck,
    CircleX,
    X,
  } from '@lucide/svelte';
  import type { ResponseEntry } from '../lib/explanation/types';

  interface Props {
    responses: ResponseEntry[];
    activeResponseIndex: number;
    pendingResponses: number;
    onSelectResponse?: (index: number) => void;
    onClose?: () => void;
  }

  let { responses, activeResponseIndex, pendingResponses, onSelectResponse, onClose }: Props =
    $props();

  let showResponseMenu = $state(false);

  const activeResponse = $derived(responses[activeResponseIndex]);
  const totalResponses = $derived(responses.length + pendingResponses);
  const successfulResponses = $derived(responses.filter((r) => r.status === 'success').length);
  const failedResponses = $derived(responses.filter((r) => r.status === 'error').length);
  const hasSuccess = $derived(responses.some((r) => r.status === 'success'));

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

  function truncateModelPartsByChars(provider: string, model: string, maxChars: number) {
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

    const remainingForModel = Math.max(maxChars - providerText.length - sep.length, 0);
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
</script>

<div class="response-status-wrapper">
  <div class="response-status-bar" class:centered={!hasSuccess}>
    <div class="response-status-left">
      <div class="response-badge" class:pulsing={pendingResponses > 0}>
        {successfulResponses}/<span class:text-error={failedResponses > 0}>{failedResponses}</span
        >/{totalResponses}
      </div>
      {#if activeResponse && hasSuccess}
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
    {#if hasSuccess}
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
            onClose?.();
          }}
          aria-label="Close status"
          title="Close Status"
        >
          <X size={15} />
        </button>
      </div>
    {/if}
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
              <Circle size={16} class="response-status-icon" fill="#e5e7eb" color="#e5e7eb" />
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
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
    transition: justify-content 0.3s ease;
  }

  .response-status-bar.centered {
    justify-content: center;
  }

  .text-error {
    color: var(--error-color);
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

  .response-badge.pulsing {
    animation: pulse 1.5s infinite ease-in-out;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
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
    transition:
      color 0.15s ease,
      background-color 0.15s ease;
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
    transition:
      background 0.15s ease,
      color 0.15s ease;
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

  /* Custom scrollbar for the modal body - if needed here, otherwise inherited */
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
