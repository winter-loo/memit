<script lang="ts">
  import { Highlighter, Languages } from '@lucide/svelte';
  import { fade } from 'svelte/transition';

  interface Props {
    x: number;
    y: number;
    onExplain: () => void;
    onHighlight?: () => void;
  }

  let { x, y, onExplain, onHighlight }: Props = $props();
</script>

<div class="selection-toolbar" style="top: {y}px; left: {x}px;" transition:fade={{ duration: 150 }}>
  <button
    class="toolbar-btn"
    onmousedown={(e) => e.preventDefault()}
    onclick={onExplain}
    title="Explain"
  >
    <Languages size={16} class="text-primary" />
  </button>
  <div class="separator"></div>
  <button
    class="toolbar-btn"
    onmousedown={(e) => e.preventDefault()}
    onclick={onHighlight}
    title="Highlight"
  >
    <Highlighter size={16} class="text-primary" />
  </button>
  <div class="arrow"></div>
</div>

<style>
  .selection-toolbar {
    position: fixed;
    z-index: 1000;
    transform: translate(-50%, -100%) translateY(-8px);
    background: white;
    border-radius: 9999px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    padding: 4px 8px;
    border: 1px solid var(--border-color, #e5e7eb);
    white-space: nowrap;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: none;
    border: none;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .toolbar-btn:hover {
    opacity: 0.8;
  }

  .separator {
    width: 1px;
    height: 12px;
    background: #e5e7eb;
    margin: 0 4px;
  }

  .arrow {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: white;
    border-right: 1px solid var(--border-color, #e5e7eb);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  :global(.text-primary) {
    color: var(--primary-color, #ff8c00);
  }
</style>
