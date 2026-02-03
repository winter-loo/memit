<script lang="ts">
  interface Props {
    size?: number;
    color?: string;
    isAnimating?: boolean;
    title?: string;
  }

  let { size = 24, color = 'currentColor', isAnimating = false, title }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="lucide lucide-audio-lines"
>
  {#if title}
    <title>{title}</title>
  {/if}
  <path d="M2 10v3" />
  <path
    d="M6 6v11"
    class:animating={isAnimating}
    style="transform-origin: center; animation-delay: 0s;"
  />
  <path
    d="M10 3v18"
    class:animating={isAnimating}
    style="transform-origin: center; animation-delay: 0.15s;"
  />
  <path
    d="M14 8v7"
    class:animating={isAnimating}
    style="transform-origin: center; animation-delay: 0.3s;"
  />
  <path
    d="M18 5v13"
    class:animating={isAnimating}
    style="transform-origin: center; animation-delay: 0.15s;"
  />
  <path d="M22 10v4" />
</svg>

<style>
  .animating {
    animation: bounce 1s ease-in-out infinite;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: scaleY(1);
    }
    50% {
      transform: scaleY(0.5);
    }
  }
</style>
