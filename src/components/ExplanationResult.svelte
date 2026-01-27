<script lang="ts">
  import type { DictionaryResponse } from '../lib/explanation/types';
  import LucideIcon from './LucideIcon.svelte';

  interface Props {
    result: DictionaryResponse;
    saveError?: string;
  }

  let { result, saveError = '' }: Props = $props();

  type Tab = 'explanation' | 'usage' | 'origin';
  let activeTab = $state<Tab>('explanation');

  function setTab(tab: Tab) {
    activeTab = tab;
  }

  let displayIPA = $derived(
    result.ipa_pronunciation && result.ipa_pronunciation.length > 27
      ? result.ipa_pronunciation.substring(0, 17) + '...' + result.ipa_pronunciation.slice(-10)
      : result.ipa_pronunciation
  );
</script>

<div class="explanation-container">
  <!-- Word Header Section -->
  <header class="word-header">
    <div class="word-line">
      <h1 class="word">{result.word}</h1>
    </div>
    <div class="phonetic-line">
      {#if displayIPA}
        <p class="ipa">{displayIPA}</p>
      {/if}
      <button class="icon-btn-small" title="Listen">
        <LucideIcon name="volume-2" size={18} />
      </button>
    </div>
  </header>

  <!-- Simple Definition Card -->
  <div class="simple-def-card">
    <div class="def-group">
      <h4 class="label">Simple Definition</h4>
      <p class="text">{result.simple_definition}</p>
    </div>
    <div class="def-group">
      <h4 class="label">Translation</h4>
      <p class="text-primary font-bold">{result.in_chinese}</p>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <nav class="tabs">
    <button
      class="tab-btn"
      class:active={activeTab === 'explanation'}
      onclick={() => setTab('explanation')}
    >
      Explanation
    </button>
    <button class="tab-btn" class:active={activeTab === 'usage'} onclick={() => setTab('usage')}>
      Usage
    </button>
    <button class="tab-btn" class:active={activeTab === 'origin'} onclick={() => setTab('origin')}>
      Origin
    </button>
  </nav>

  <!-- Tab Content -->
  <div class="tab-content">
    {#if activeTab === 'explanation'}
      <section class="section">
        <h3 class="section-title">
          <LucideIcon name="info" size={18} className="icon-orange" />
          Detailed Explanation
        </h3>
        <p class="detailed-text">{result.detailed_explanation}</p>
      </section>
    {/if}

    {#if activeTab === 'usage'}
      <section class="section">
        <div class="section-header">
          <LucideIcon name="quote" size={18} className="icon-orange" />
          <h3 class="section-title">Example Sentences</h3>
        </div>
        <div class="example-stack">
          {#each result.examples as example, i (i)}
            <div class="example-card">
              <p class="example-text">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html example.replace(
                  new RegExp(`(${result.word})`, 'gi'),
                  '<span class="highlight">$1</span>'
                )}
              </p>
            </div>
          {/each}
        </div>
      </section>

      {#if result.context_usage}
        <section class="section">
          <div class="section-header">
            <LucideIcon name="brain" size={18} className="icon-orange" />
            <h3 class="section-title">Context Usage</h3>
          </div>
          <div class="context-card">
            <p class="context-text">{result.context_usage}</p>
          </div>
        </section>
      {/if}
    {/if}

    {#if activeTab === 'origin'}
      {#if result.etymology}
        <section class="section">
          <div class="section-header">
            <LucideIcon name="history" size={18} className="icon-orange" />
            <h3 class="section-title">Etymology</h3>
          </div>
          <div class="info-card">
            <p class="info-text">{result.etymology}</p>
          </div>
        </section>
      {/if}

      {#if result.synonyms && result.synonyms.length > 0}
        <section class="section">
          <div class="section-header">
            <LucideIcon name="arrow-left-right" size={18} className="icon-orange" />
            <h3 class="section-title">Synonyms</h3>
          </div>
          <div class="info-card compact">
            <p class="info-text small">{result.synonyms.join(', ')}</p>
          </div>
        </section>
      {/if}

      {#if result.antonyms && result.antonyms.length > 0}
        <section class="section">
          <div class="section-header">
            <LucideIcon name="circle-minus" size={18} className="icon-orange" />
            <h3 class="section-title">Antonyms</h3>
          </div>
          <div class="info-card compact">
            <p class="info-text small">{result.antonyms.join(', ')}</p>
          </div>
        </section>
      {/if}
    {/if}
  </div>

  {#if saveError}
    <div class="error-toast">
      <LucideIcon name="triangle-alert" size={18} />
      {saveError}
    </div>
  {/if}
</div>

<style>
  .explanation-container {
    display: flex;
    flex-direction: column;
    background: var(--bg-dark);
  }

  /* Word Header */
  .word-header {
    padding: var(--spacing-xl) var(--spacing-lg) var(--spacing-md);
  }

  .word-line {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: 0.4rem;
  }

  .word {
    font-size: 1.6rem;
    font-weight: 400;
    color: var(--text-main);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .phonetic-line {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .ipa {
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 500;
    font-style: italic;
    margin: 0;
  }

  .icon-btn-small {
    background: none;
    border: none;
    color: var(--text-muted);
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .icon-btn-small:hover {
    color: var(--primary-color);
  }

  .icon-btn-small :global(.lucide-icon) {
    width: 18px;
    height: 18px;
  }

  /* Simple Def Card */
  .simple-def-card {
    margin: 0 var(--spacing-lg) var(--spacing-lg);
    background: var(--card-bg-accent);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    padding: var(--spacing-md) var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    box-shadow: var(--shadow-sm);
  }

  .def-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    margin: 0;
  }

  .text {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin: 0;
  }

  .text-primary {
    color: var(--primary-color);
  }

  .font-bold {
    font-weight: 700;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 2rem;
    padding: 0 var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    background: var(--bg-dark);
    z-index: 10;
  }

  .tab-btn {
    background: none;
    border: none;
    padding-bottom: var(--spacing-sm);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    cursor: pointer;
    position: relative;
    transition: color var(--transition-fast);
  }

  .tab-btn:hover {
    color: var(--text-main);
  }

  .tab-btn.active {
    color: var(--primary-color);
  }

  .tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 2px;
    background: var(--primary-color);
    box-shadow: 0 0 8px rgba(242, 139, 13, 0.6);
  }

  /* Sections */
  .tab-content {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
  }

  .section {
    display: flex;
    flex-direction: column;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    opacity: 0.8;
  }

  .section-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global(.icon-orange) {
    color: var(--primary-color);
  }

  .detailed-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }

  /* Examples & Usage */
  .example-stack {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .example-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    padding: var(--spacing-md);
    transition: all var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .example-card:hover {
    border-color: rgba(242, 139, 13, 0.3);
    box-shadow: var(--shadow-md);
  }

  .example-text {
    font-size: 15px;
    color: var(--text-main);
    line-height: 1.5;
    font-weight: 500;
    margin: 0;
  }

  :global(.highlight) {
    color: var(--primary-color);
    font-weight: 700;
    text-decoration: underline;
    text-decoration-color: rgba(242, 139, 13, 0.4);
    text-underline-offset: 4px;
    text-decoration-thickness: 2px;
  }

  .context-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    padding: var(--spacing-md);
    box-shadow: var(--shadow-sm);
  }

  .context-text {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  /* Info Cards (Origin) */
  .info-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    padding: var(--spacing-md);
    box-shadow: var(--shadow-sm);
  }

  .info-text {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .info-text.small {
    font-size: 12px;
    letter-spacing: 0.02em;
  }

  .info-card.compact {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  /* Error Toast */
  .error-toast {
    position: fixed;
    bottom: var(--spacing-lg);
    left: 50%;
    transform: translateX(-50%);
    background: var(--error-bg);
    color: var(--error-color);
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--radius-md);
    border: 1px solid var(--error-border);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 12px;
    z-index: 100;
    white-space: pre-wrap;
    text-align: center;
    max-width: 90%;
    box-shadow: var(--shadow-md);
  }
</style>
