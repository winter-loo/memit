<script lang="ts">
  interface Props {
    height?: number;
    class?: string;
  }
  let { height = 28, class: className = '' }: Props = $props();
</script>

<!--
  Wordmark: the "M" is built from the brand icon (pillars + spark),
  "EMIT" follows in matching weight and color.
  ViewBox: 0 0 108 32
-->
<svg
  class={className}
  role="img"
  aria-label="memit"
  height={height}
  viewBox="0 0 108 32"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Spark above the M -->
  <path
    d="M14 1L15.4 4.9L19.3 6.3L15.4 7.7L14 11.6L12.6 7.7L8.7 6.3L12.6 4.9Z"
    fill="#FF8C00"
  >
    <animate attributeName="opacity" values="1;0.7;1" dur="3s" repeatCount="indefinite" />
  </path>

  <!-- Left pillar -->
  <rect x="2" y="12" width="4.5" height="18" rx="1.5" fill="#2D3748" />
  <!-- Right pillar -->
  <rect x="21.5" y="12" width="4.5" height="18" rx="1.5" fill="#2D3748" />
  <!-- Center pillar (orange) -->
  <rect x="11.75" y="15.5" width="4.5" height="14.5" rx="1.5" fill="#FF8C00" />

  <!-- Brace left -->
  <path d="M6.5 12L11.75 15.5" stroke="#2D3748" stroke-width="1.8" stroke-linecap="round" />
  <!-- Brace right -->
  <path d="M21.5 12L16.25 15.5" stroke="#2D3748" stroke-width="1.8" stroke-linecap="round" />

  <!-- "EMIT" text, vertically aligned with the pillars -->
  <text
    x="28"
    y="28"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="19"
    font-weight="700"
    letter-spacing="1.5"
    fill="#2D3748"
  >EMIT</text>
</svg>
