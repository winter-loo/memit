<script lang="ts">
  import type { DictionaryResponse } from '../lib/explanation/types';
  import ExplanationResult from './ExplanationResult.svelte';
  import Skeleton from './Skeleton.svelte';

  interface Props {
    result?: DictionaryResponse;
    isLoading?: boolean;
    error?: string;
    onClose?: () => void;
    onSave?: () => void;
    onRetry?: () => void;
    isSaving?: boolean;
    saveError?: string;
    isSaved?: boolean;
  }

  let {
    result,
    isLoading = false,
    error = '',
    onClose,
    onSave,
    onRetry,
    isSaving = false,
    saveError = '',
    isSaved = false,
  }: Props = $props();
</script>

<div class="modal-container" role="dialog" aria-modal="true">
  <header class="modal-header">
    <div class="brand">
      <div class="brand-icon">
        <span class="material-symbols-outlined">translate</span>
      </div>
      <h2 class="brand-name">memit</h2>
    </div>
    <div class="actions">
      <button
        class="action-btn"
        onclick={onSave}
        disabled={isSaving || isSaved}
        title="Save to Anki"
      >
        <span class="material-symbols-outlined">{isSaved ? 'check' : 'save'}</span>
      </button>
      <button class="action-btn" title="Practice">
        <span class="material-symbols-outlined">sports_esports</span>
      </button>
      <button class="action-btn close" onclick={onClose} title="Close">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
  </header>

  <div class="modal-body custom-scrollbar">
    {#if isLoading}
      <Skeleton />
    {:else if error}
      <div class="error-container">
        <div class="error-icon">
          <span class="material-symbols-outlined">sentiment_dissatisfied</span>
        </div>
        <h3 class="error-title">Something went wrong</h3>
        <p class="error-message">{error}</p>
        {#if onRetry}
          <button class="retry-btn" onclick={onRetry}>
            <span class="material-symbols-outlined">refresh</span>
            Try Again
          </button>
        {/if}
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

  .brand-icon span {
    font-size: 20px;
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

  .action-btn span {
    font-size: 20px;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0;
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

  .error-icon span {
    font-size: 32px;
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

  .retry-btn {
    margin-top: var(--spacing-md);
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
  }

  .retry-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  .retry-btn span {
    font-size: 18px;
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
