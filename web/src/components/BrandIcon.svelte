<script>
  let {
    title = '',
    path = '',
    size = 20,
    color = 'currentColor',
    viewBox = '0 0 24 24'
  } = $props();
</script>

<svg
  width={size}
  height={size}
  {viewBox}
  role="img"
  aria-label={title}
  xmlns="http://www.w3.org/2000/svg"
  style={`color:${color}`}
  fill="currentColor"
>
  <path d={path} />
</svg>
