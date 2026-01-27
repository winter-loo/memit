<script lang="ts">
  import type { IconNode } from '../lib/icons';

  /**
   * Local Icon component to bypass external style injection issues in Shadow DOM.
   * Renders Lucide icon data directly with internal styling.
   */
  interface Props {
    iconNodes: IconNode;
    size?: number;
    strokeWidth?: number;
    class?: string;
    color?: string;
  }

  let {
    iconNodes,
    size = 24,
    strokeWidth = 2,
    class: className = '',
    color = 'currentColor',
  }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class="lucide-icon {className}"
>
  {#each iconNodes as [tag, attrs], i (i)}
    <svelte:element this={tag} {...attrs} />
  {/each}
</svg>

<style>
  .lucide-icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
    /* Ensure the stroke is always visible */
    stroke: currentColor;
  }
</style>
