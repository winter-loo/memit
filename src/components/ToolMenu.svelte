<script lang="ts">
  import Icon from './Icon.svelte';
  import * as Icons from '../lib/icons';
  import { fly } from 'svelte/transition';

  interface Props {
    x: number;
    y: number;
    onExplain: () => void;
    onHighlight: () => void;
  }

  let { x, y, onExplain, onHighlight }: Props = $props();
</script>

<div
  class="tool-menu"
  style="left: {x}px; top: {y}px;"
  transition:fly={{ y: 5, duration: 150 }}
  role="menu"
  tabindex="-1"
>
  <button class="tool-btn" onclick={onExplain} title="Explain this selection">
    <Icon iconNodes={Icons.languages} size={14} />
    <span>Explain</span>
  </button>
  <div class="divider"></div>
  <button class="tool-btn" onclick={onHighlight} title="Highlight this selection">
    <Icon iconNodes={Icons.info} size={14} />
    <span>Highlight</span>
  </button>
</div>

<style>
  .tool-menu {
    position: fixed;
    display: flex;
    align-items: center;
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    padding: 4px;
    z-index: 1000;
    gap: 2px;
    pointer-events: auto;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-secondary);
    padding: 6px 10px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .tool-btn:hover {
    background: var(--bg-deep);
    color: var(--primary-color);
  }

  .tool-btn span {
    font-family: var(--font-sans);
  }

  .divider {
    width: 1px;
    height: 16px;
    background: var(--border-color);
    margin: 0 4px;
  }
</style>
