<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    containerRef?: HTMLDivElement | null;
    header?: Snippet;
    children?: Snippet;
  };

  let { containerRef = $bindable(null), header, children }: Props = $props();

  let isDragging = $state(false);
  let dragStart = { x: 0, y: 0 };
  let dragOrigin = { x: 0, y: 0 };
  let hostElement: HTMLElement | null = null;

  function resolveHostElement() {
    if (hostElement) return hostElement;
    const root = containerRef?.getRootNode();
    if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
      hostElement = root.host;
    }
    return hostElement;
  }

  function getHostPosition() {
    const host = resolveHostElement();
    if (!host) return { x: 0, y: 0 };
    const left = Number.parseFloat(host.style.left);
    const top = Number.parseFloat(host.style.top);
    if (Number.isFinite(left) && Number.isFinite(top)) {
      return { x: left, y: top };
    }
    const rect = host.getBoundingClientRect();
    return { x: rect.left + window.scrollX, y: rect.top + window.scrollY };
  }

  function onHeaderPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    const host = resolveHostElement();
    if (!host) return;
    isDragging = true;
    dragStart = { x: event.clientX, y: event.clientY };
    dragOrigin = getHostPosition();
    event.preventDefault();
  }

  function onWindowPointerMove(event: PointerEvent) {
    if (!isDragging) return;
    const host = resolveHostElement();
    if (!host) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    host.style.left = `${dragOrigin.x + dx}px`;
    host.style.top = `${dragOrigin.y + dy}px`;
  }

  function stopDrag() {
    isDragging = false;
  }

  $effect(() => {
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  });
</script>

<div class="modal-container" role="dialog" aria-modal="true" bind:this={containerRef}>
  <header class="modal-header" class:dragging={isDragging} onpointerdown={onHeaderPointerDown}>
    {@render header?.()}
  </header>
  <div class="modal-body custom-scrollbar">
    {@render children?.()}
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
    padding: var(--spacing-sm) var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-header);
    z-index: 20;
    cursor: grab;
  }

  .modal-header.dragging {
    cursor: grabbing;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0;
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
