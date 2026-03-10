<script lang="ts">
  interface Props {
    size?: number;
    class?: string;
  }
  let { size = 24, class: className = '' }: Props = $props();
</script>

<svg
  class={className}
  role="img"
  width={size}
  height={size}
  viewBox="0 0 128 128"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-label="memit"
>
<rect x="30" y="44" width="16" height="50" rx="4" fill="#2D3748" />
  <rect x="82" y="44" width="16" height="50" rx="4" fill="#2D3748" />
  <rect x="56" y="54" width="16" height="40" rx="4" fill="#FF8C00" />
  <path
    d="M64 22L67.5 31.5L77 35L67.5 38.5L64 48L60.5 38.5L51 35L60.5 31.5L64 22Z"
    fill="#FF8C00"
  >
    <animate attributeName="opacity" values="1;0.7;1" dur="3s" repeatCount="indefinite" />
  </path>
  <path d="M46 44L56 54" stroke="#2D3748" stroke-width="6" stroke-linecap="round" />
  <path d="M82 44L72 54" stroke="#2D3748" stroke-width="6" stroke-linecap="round" />
</svg>
