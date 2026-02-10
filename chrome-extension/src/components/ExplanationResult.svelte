<script lang="ts">
  import type { DictionaryResponse } from '../lib/explanation/types';
  import DOMPurify from 'dompurify';
  import { marked } from 'marked';
  import {
    ArrowLeftRight,
    Brain,
    CircleMinus,
    History,
    Info,
    MoveLeft,
    MoveRight,
    Quote,
    TriangleAlert,
    Download,
  } from '@lucide/svelte';
  import AudioLines from './icons/AudioLines.svelte';

  interface Props {
    result: DictionaryResponse;
    saveError?: string;
    onBack?: () => void;
    onForward?: () => void;
  }

  let { result, saveError = '', onBack, onForward }: Props = $props();

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

  const detailedExplanationHtml = $derived.by(() => {
    const rawHtml = marked.parse(result.detailed_explanation ?? '', { breaks: true }) as string;
    return DOMPurify.sanitize(rawHtml);
  });

  let ttsState = $state<'idle' | 'loading' | 'speaking'>('idle');
  let exportState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');

  function speak() {
    if (ttsState !== 'idle') return;
    ttsState = 'loading';
    chrome.runtime.sendMessage({ type: 'SPEAK_TEXT', text: result.word });
  }

  function exportToAnkiConnect() {
    if (exportState === 'loading') return;
    exportState = 'loading';

    // Construct a simple note for AnkiConnect
    // Default model: "Basic", Fields: Front, Back
    // We'll put word on Front, and details on Back
    const note = {
      deckName: 'Default',
      modelName: 'Basic',
      fields: {
        Front: result.word,
        Back: `
          <strong>${result.simple_definition}</strong><br>
          ${result.in_chinese}<br><br>
          <em>${result.ipa_pronunciation || ''}</em><br><br>
          ${result.detailed_explanation ? marked.parse(result.detailed_explanation) : ''}
        `,
        tags: ['memit'],
      },
    };

    chrome.runtime.sendMessage(
      {
        type: 'EXPORT_TO_ANKI_CONNECT',
        note,
      },
      (response) => {
        if (response && response.success) {
          exportState = 'success';
          setTimeout(() => (exportState = 'idle'), 2000);
        } else {
          exportState = 'error';
          // You might want to show the error message in a toast
          console.error('AnkiConnect error:', response?.error);
          alert(
            'Failed to export to Anki Desktop. Make sure Anki is running with AnkiConnect installed.'
          );
          setTimeout(() => (exportState = 'idle'), 3000);
        }
      }
    );
  }

  $effect(() => {
    const listener = (message: { type: string; status: string }) => {
      if (message.type === 'TTS_EVENT') {
        if (message.status === 'start') {
          ttsState = 'speaking';
        } else if (['end', 'interrupted', 'cancelled', 'error'].includes(message.status)) {
          ttsState = 'idle';
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  });
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
      <button
        class="icon-btn-small"
        class:loading={ttsState === 'loading'}
        class:speaking={ttsState === 'speaking'}
        title="Listen"
        onclick={speak}
      >
        <AudioLines size={18} isAnimating={ttsState !== 'idle'} />
      </button>
      <button
        class="icon-btn-small"
        class:loading={exportState === 'loading'}
        class:success={exportState === 'success'}
        class:error={exportState === 'error'}
        title="Export to Anki Desktop"
        onclick={exportToAnkiConnect}
      >
        <Download size={18} />
      </button>
    </div>
  </header>

  <!-- Simple Definition Card -->
  <div class="simple-def-card">
    <div class="def-group">
      <div class="def-header">
        <h4 class="label">Simple Definition</h4>
        <div class="nav-actions">
          {#if onBack}
            <button class="icon-btn-small nav-btn" onclick={onBack} title="Go Back">
              <MoveLeft size={18} />
            </button>
          {/if}
          {#if onForward}
            <button class="icon-btn-small nav-btn" onclick={onForward} title="Go Forward">
              <MoveRight size={18} />
            </button>
          {/if}
        </div>
      </div>
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
          <Info size={18} class="icon-orange" />
          Detailed Explanation
        </h3>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="detailed-text markdown-body">{@html detailedExplanationHtml}</div>
      </section>
    {/if}

    {#if activeTab === 'usage'}
      <section class="section">
        <div class="section-header">
          <Quote size={18} class="icon-orange" />
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
            <Brain size={18} class="icon-orange" />
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
            <History size={18} class="icon-orange" />
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
            <ArrowLeftRight size={18} class="icon-orange" />
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
            <CircleMinus size={18} class="icon-orange" />
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
      <TriangleAlert size={18} />
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
    padding: var(--spacing-md) var(--spacing-lg);
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
    transition:
      color var(--transition-fast),
      transform var(--transition-fast);
  }

  .icon-btn-small:hover {
    color: var(--primary-color);
    transform: scale(1.1);
  }

  .icon-btn-small.loading {
    /* Loading: Animate (via prop) but keep default color */
    color: var(--text-muted);
    opacity: 0.8;
  }

  .icon-btn-small.speaking {
    color: var(--primary-color);
    /* Speaking: Animate (via prop) AND colorize */
  }

  .icon-btn-small.success {
    color: #22c55e; /* Green */
  }

  .icon-btn-small.error {
    color: #ef4444; /* Red */
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

  .def-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .nav-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .nav-btn {
    color: var(--text-muted);
  }

  .nav-btn:hover {
    color: var(--primary-color);
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

  .markdown-body :global(p) {
    margin: 0 0 var(--spacing-sm);
  }

  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    margin: 0 0 var(--spacing-sm);
    padding-left: 1.2rem;
  }

  .markdown-body :global(li) {
    margin: 0.2rem 0;
  }

  .markdown-body :global(code) {
    font-family: 'SFMono-Regular', 'Menlo', 'Consolas', monospace;
    font-size: 0.9em;
    background: rgba(255, 255, 255, 0.08);
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
  }

  .markdown-body :global(pre) {
    background: rgba(0, 0, 0, 0.25);
    padding: var(--spacing-sm);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  .markdown-body :global(pre code) {
    background: transparent;
    padding: 0;
  }

  .markdown-body :global(blockquote) {
    margin: 0 0 var(--spacing-sm);
    padding: 0.4rem 0.8rem;
    border-left: 3px solid var(--primary-color);
    background: rgba(255, 255, 255, 0.06);
  }

  .markdown-body :global(a) {
    color: var(--primary-color);
    text-decoration: underline;
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
