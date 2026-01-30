<script lang="ts">
  import type { DictionaryResponse } from '../lib/explanation/types';
  import ExplanationResult from './ExplanationResult.svelte';
  import ResponseStatusBar from './ResponseStatusBar.svelte';
  import RetryModelSelector from './RetryModelSelector.svelte';
  import SelectionToolbar from './SelectionToolbar.svelte';
  import Skeleton from './Skeleton.svelte';
  import { countWords } from '../lib/text-utils';
  import {
    CircleX,
    CloudAlert,
    CloudCheck,
    CloudUpload,
    Frown,
    Gamepad2,
    Languages,
    RefreshCw,
    X,
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
    onNewQuery?: (text: string) => void;
    onBack?: () => void;
    onForward?: () => void;
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
    pendingModelIds?: string[];
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
    onNewQuery,
    onBack,
    onForward,
    isSaving = false,
    isRetrying = false,
    saveError = '',
    isSaved = false,
    responses = [],
    activeResponseIndex = 0,
    pendingResponses = 0,
    pendingModelIds = [],
    onSelectResponse,
  }: Props = $props();

  const activeResponse = $derived(responses[activeResponseIndex]);
  const totalResponses = $derived(
    new Set([...responses.map((r) => r.modelId), ...pendingModelIds]).size
  );
  const successfulResponses = $derived(responses.filter((r) => r.status === 'success').length);
  const failedResponses = $derived(responses.filter((r) => r.status === 'error').length);
  const hasSuccess = $derived(responses.some((r) => r.status === 'success'));

  function handleRetry(
    newModelId: string,
    apiKeys: { openRouter?: string; gemini?: string },
    newText?: string
  ) {
    onRetry?.(newModelId, apiKeys, newText);
  }

  let showResponseBar = $state(true);

  /**
   * We use $state + $effect instead of $derived.by(() => modelId) for localModelId because:
   * 1. $derived is read-only and would break the 'bind:value' needed for the model selection dropdown.
   * 2. We need a "buffered state" that allows users to pick a model locally without immediately
   *    triggering a global storage update.
   * 3. The $effect ensures the local UI still stays in sync if the global settings change externally.
   * 4. Changes are only committed to global storage when the user clicks 'Switch Provider'.
   */
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localModelId = $state('');
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localOpenRouterApiKey = $state('');
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localGeminiApiKey = $state('');
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localText = $state('');

  const localWordCount = $derived(countWords(localText));
  const isTooLongError = $derived(error.toLowerCase().includes('too long'));

  // Selection toolbar state
  let selectionToolbar = $state<{ x: number; y: number; text: string; range: Range } | null>(null);
  let modalRef: HTMLDivElement;

  function mergeRanges(ranges: Range[]) {
    if (ranges.length === 0) {
      return null;
    }

    let startRange = ranges[0];
    let endRange = ranges[0];

    for (let i = 1; i < ranges.length; i += 1) {
      const range = ranges[i];
      if (range.compareBoundaryPoints(Range.START_TO_START, startRange) < 0) {
        startRange = range;
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, endRange) > 0) {
        endRange = range;
      }
    }

    const merged = document.createRange();
    merged.setStart(startRange.startContainer, startRange.startOffset);
    merged.setEnd(endRange.endContainer, endRange.endOffset);
    return merged;
  }

  function closeSelectionToolbar() {
    selectionToolbar = null;
  }

  function handleSelection() {
    const rootNode = modalRef?.getRootNode();
    const selection =
      rootNode instanceof ShadowRoot && (rootNode as unknown as Document).getSelection
        ? (rootNode as unknown as Document).getSelection()
        : window.getSelection();

    console.log('handleSelection:', selection, selection?.rangeCount, selection?.toString());

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      closeSelectionToolbar();
      return;
    }

    console.log('range count: ', selection.rangeCount);
    const range = selection.getRangeAt(0);
    const container = modalRef;

    console.log('Container contains:', container?.contains(range.commonAncestorContainer));

    // Check if selection is inside the modal
    if (container && container.contains(range.commonAncestorContainer)) {
      const text = selection.toString().trim();
      if (text) {
        const rect = range.getBoundingClientRect();
        // Calculate position relative to viewport since toolbar is fixed
        selectionToolbar = {
          x: rect.left + rect.width / 2,
          y: rect.top,
          text,
          range,
        };
        console.log('Selection toolbar open:', selectionToolbar);
        return;
      }
    }
    closeSelectionToolbar();
  }

  // Handle document-level selection change to clear toolbar when clicking outside
  function onDocumentSelectionChange() {
    // We defer slightly to let the click event potentially clear it or new selection form
    setTimeout(() => {
      handleSelection();
    }, 10);
  }

  $effect(() => {
    document.addEventListener('selectionchange', onDocumentSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onDocumentSelectionChange);
    };
  });

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
      showResponseBar = true;
    }
  });
</script>

{#snippet badgeSnippet()}
  {#if totalResponses > 1 && !hasSuccess}
    <div class="response-badge-inline" class:pulsing={pendingResponses > 0}>
      {successfulResponses}/<span class:text-error={failedResponses > 0}>{failedResponses}</span
      >/{totalResponses}
    </div>
  {/if}
{/snippet}

<div class="modal-container" role="dialog" aria-modal="true" bind:this={modalRef}>
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
        title={saveError ? 'Error saving' : isSaved ? 'Saved to Anki' : 'Save to Anki'}
      >
        {#if isSaving}
          <CloudUpload size={20} class="pulsing text-primary" />
        {:else if saveError}
          <CloudAlert size={20} class="text-error" />
        {:else if isSaved}
          <CloudCheck size={20} class="text-success" />
        {:else}
          <CloudUpload size={20} />
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
    {#if showResponseBar && totalResponses > 1 && hasSuccess}
      <ResponseStatusBar
        {responses}
        {activeResponseIndex}
        {pendingResponses}
        {onSelectResponse}
        onClose={() => {
          showResponseBar = false;
        }}
      />
    {/if}

    {#if isLoading && !hasSuccess}
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
              <RetryModelSelector
                bind:modelId={localModelId}
                bind:openRouterApiKey={localOpenRouterApiKey}
                bind:geminiApiKey={localGeminiApiKey}
                onRetry={handleRetry}
                label="Wait too long? Try another model:"
                idPrefix="loading"
                buttonText="Switch Provider"
                disabledModels={pendingModelIds}
                badge={badgeSnippet}
              />
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
          <RetryModelSelector
            bind:modelId={localModelId}
            bind:openRouterApiKey={localOpenRouterApiKey}
            bind:geminiApiKey={localGeminiApiKey}
            onRetry={handleRetry}
            idPrefix="modal"
            compact={false}
            disabledModels={pendingModelIds}
            badge={badgeSnippet}
          />
        {:else if isTooLongError}
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
                  handleRetry(
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

        {#if error && isTooLongError}
          <p class="hint-message">
            The text should have at most 20 words and current length is {localWordCount}.
          </p>
        {:else if error}
          <p class="error-message">{error}</p>
        {/if}
      </div>
    {:else if responses.length > 0}
      {#if activeResponse?.status === 'error'}
        <div class="response-error">
          <div class="response-error-title">
            <CircleX size={16} />
            Request failed
          </div>

          <RetryModelSelector
            bind:modelId={localModelId}
            bind:openRouterApiKey={localOpenRouterApiKey}
            bind:geminiApiKey={localGeminiApiKey}
            onRetry={handleRetry}
            idPrefix="error-response"
            disabledModels={pendingModelIds}
            badge={badgeSnippet}
          />

          <div class="error-separator"></div>
          <p class="response-error-message">{activeResponse.error}</p>
        </div>
      {:else if activeResponse?.result}
        <ExplanationResult result={activeResponse.result} {saveError} {onBack} {onForward} />
      {:else if result}
        <ExplanationResult {result} {saveError} {onBack} {onForward} />
      {/if}
    {:else if result}
      <ExplanationResult {result} {saveError} {onBack} {onForward} />
    {/if}
  </div>

  {#if selectionToolbar}
    <SelectionToolbar
      x={selectionToolbar.x}
      y={selectionToolbar.y}
      onExplain={() => {
        if (selectionToolbar) {
          onNewQuery?.(selectionToolbar.text);
          closeSelectionToolbar();
        }
      }}
      onHighlight={() => {
        if (selectionToolbar) {
          try {
            const highlights = Array.from(modalRef.querySelectorAll('.highlight'));
            const selectionRange = selectionToolbar.range;
            console.log('my selection range: ', selectionRange);
            const intersecting = highlights.filter((span) => selectionRange.intersectsNode(span));
            const intersectingRanges = intersecting.map((span) => {
              const range = document.createRange();
              range.selectNodeContents(span);
              return range;
            });
            // Capture the full boundary before mutating DOM so we can re-create the range later.
            const boundaryRange = mergeRanges([selectionRange, ...intersectingRanges]);
            if (!boundaryRange) {
              closeSelectionToolbar();
              return;
            }
            // Insert stable markers so DOM changes don't invalidate the intended range.
            // We unwrap highlight spans next, which mutates text nodes and can stale existing
            // Range objects. These markers pin the exact pre-mutation boundaries so we can
            // rebuild a fresh Range between them afterward.
            const startMarker = document.createComment('highlight-start');
            const endMarker = document.createComment('highlight-end');
            const endRange = boundaryRange.cloneRange();
            endRange.collapse(false);
            endRange.insertNode(endMarker);
            const startRange = boundaryRange.cloneRange();
            startRange.collapse(true);
            startRange.insertNode(startMarker);

            if (intersecting.length > 0) {
              // Unwrap existing highlights that overlap the selection (toggle off).
              intersecting.forEach((span) => {
                const parent = span.parentNode;
                if (!parent) {
                  return;
                }
                while (span.firstChild) {
                  parent.insertBefore(span.firstChild, span);
                }
                parent.removeChild(span);
              });
            }

            // Rebuild the merged range from markers after unwrapping highlights.
            const mergedRange = document.createRange();
            mergedRange.setStartAfter(startMarker);
            mergedRange.setEndBefore(endMarker);
            startMarker.remove();
            endMarker.remove();

            const span = document.createElement('span');
            span.className = 'highlight';
            try {
              mergedRange.surroundContents(span);
            } catch {
              // Fallback for partially-selected nodes (surroundContents would throw).
              const contents = mergedRange.extractContents();
              span.appendChild(contents);
              mergedRange.insertNode(span);
            }
            // Normalize to merge adjacent text nodes after wrapping.
            span.parentNode?.normalize();
          } catch (e) {
            console.error('Failed to highlight:', e);
          }
          closeSelectionToolbar();
        }
      }}
    />
  {/if}
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
    justify-content: flex-start;
    gap: var(--spacing-sm);
    font-weight: 700;
    font-size: 13px;
    margin-bottom: var(--spacing-xs);
    text-align: left;
  }

  .response-error-message {
    font-size: 12px;
    margin: 0;
    line-height: 1.5;
  }

  .error-separator {
    height: 1px;
    background: #fee2e2;
    margin: var(--spacing-md) 0;
    width: 100%;
  }

  .text-error {
    color: var(--error-color);
  }

  :global(.text-success) {
    color: var(--success-color);
  }

  :global(.text-primary) {
    color: var(--primary-color);
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

  .hint-message {
    font-size: 13px;
    line-height: 1.5;
    color: var(--primary-color);
    font-weight: 500;
    margin: 0;
    max-width: 320px;
  }

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

  .text-shortener label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

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

  .retry-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  .response-badge-inline {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: auto;
  }

  .response-badge-inline.pulsing {
    animation: pulse 1.5s infinite ease-in-out;
  }

  :global(.pulsing) {
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
