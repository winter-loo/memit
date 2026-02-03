<script lang="ts">
  let { isRetrying = false } = $props();
</script>

<div class="skeleton-container" class:retrying={isRetrying}>
  <!-- Header Section -->
  <div class="header-skeleton">
    <div class="word-line">
      <div class="skeleton word-box"></div>
    </div>
    <div class="skeleton phonetic-box"></div>
  </div>

  <!-- Simple Definition Card -->
  <div class="card-skeleton">
    <div class="skeleton label-box"></div>
    <div class="skeleton text-box-lg"></div>
    <div class="skeleton label-box" style="margin-top: 1rem;"></div>
    <div class="skeleton text-box-md"></div>
  </div>

  <!-- Tabs -->
  <div class="tabs-skeleton">
    <div class="skeleton tab-box"></div>
    <div class="skeleton tab-box"></div>
    <div class="skeleton tab-box"></div>
  </div>

  <!-- Content -->
  <div class="content-skeleton">
    <div class="skeleton title-box"></div>
    <div class="skeleton-text-group">
      <div class="skeleton line"></div>
      <div class="skeleton line"></div>
      <div class="skeleton line-short"></div>
    </div>
  </div>
</div>

<style>
  .skeleton-container {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    height: 100%;
    overflow: hidden;
  }

  .skeleton-container.retrying .skeleton {
    background: var(--border-color);
    animation: none;
  }

  .skeleton {
    background: linear-gradient(
      90deg,
      var(--border-color) 25%,
      var(--skeleton-shimmer) 50%,
      var(--border-color) 75%
    );
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: var(--radius-sm);
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .word-line {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .word-box {
    width: 180px;
    height: 2.5rem;
  }
  .phonetic-box {
    width: 120px;
    height: 1rem;
  }

  .card-skeleton {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    padding: var(--spacing-md) var(--spacing-lg);
  }

  .label-box {
    width: 60px;
    height: 0.6rem;
    margin-bottom: 0.5rem;
  }
  .text-box-lg {
    width: 90%;
    height: 1rem;
  }
  .text-box-md {
    width: 40%;
    height: 1.2rem;
  }

  .tabs-skeleton {
    display: flex;
    gap: 2rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: var(--spacing-sm);
  }

  .tab-box {
    width: 70px;
    height: 0.8rem;
  }

  .title-box {
    width: 100px;
    height: 0.8rem;
    margin-bottom: 1rem;
  }

  .skeleton-text-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .line {
    width: 100%;
    height: 0.9rem;
  }
  .line-short {
    width: 60%;
    height: 0.9rem;
  }
</style>
