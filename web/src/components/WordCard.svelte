<script>
  import { onDestroy } from 'svelte';

  let { word, onDelete, onRemoved } = $props();

  let isPhrase = $derived((word.text || '').trim().split(/\s+/).length >= 2);

  let rootEl = $state(/** @type {HTMLElement | null} */ (null));
  let canvasEl = $state(/** @type {HTMLCanvasElement | null} */ (null));

  let deleting = $state(false);
  let dissolving = $state(false);
  let deleteError = $state(false);

  /** @type {'idle' | 'pending' | 'success' | 'fail'} */
  let phase = $state('idle');
  let phaseStart = 0;

  /** @type {any[]} */
  let particles = [];
  let canvasW = 0;
  let canvasH = 0;

  let rafId = 0;

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });

  /** @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} x @param {number} y @param {number} maxWidth @param {number} lineHeight */
  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/).filter(Boolean);
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = w;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  /** @param {HTMLElement} el */
  function safeLineHeight(el) {
    const cs = getComputedStyle(el);
    const lh = cs.lineHeight;
    const fs = Number.parseFloat(cs.fontSize || '16') || 16;
    if (!lh || lh === 'normal') return fs * 1.25;
    const n = Number.parseFloat(lh);
    return Number.isFinite(n) ? n : fs * 1.25;
  }

  /** @param {HTMLElement} el */
  function fontString(el) {
    const cs = getComputedStyle(el);
    // Best-effort: preserve font-size + family; keep bold if needed
    const fw = cs.fontWeight || '400';
    const fs = cs.fontSize || '16px';
    const ff = cs.fontFamily || 'sans-serif';
    return `${fw} ${fs} ${ff}`;
  }

  /** @param {number} w @param {number} h */
  function createParticlesFromCanvas(w, h) {
    const c = canvasEl;
    if (!c) return [];
    const ctx = c.getContext('2d');
    if (!ctx) return [];
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const out = [];
    const step = 6; // lower => more particles
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const base = (y * w + x) * 4;
        const a = data[base + 3];
        if (a > 20) {
          const r = data[base];
          const g = data[base + 1];
          const b = data[base + 2];
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.2 + Math.random() * 2.2;
          out.push({
            x0: x,
            y0: y,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            a: 1,
            r,
            g,
            b
          });
        }
      }
    }
    return out;
  }

  function clearCanvas() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  async function initParticles() {
    if (!rootEl || !canvasEl) return false;

    const rect = rootEl.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    canvasW = w;
    canvasH = h;
    canvasEl.width = w;
    canvasEl.height = h;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return false;

    // Draw all text nodes (best-effort) onto canvas
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);

    const textEls = rootEl.querySelectorAll('[data-dissolve]');
    for (const node of textEls) {
      if (!(node instanceof HTMLElement)) continue;
      const r = node.getBoundingClientRect();
      const x = r.left - rect.left;
      const y = r.top - rect.top;
      const maxWidth = r.width;
      ctx.font = fontString(node);
      ctx.fillStyle = getComputedStyle(node).color || '#000';
      const lineHeight = safeLineHeight(node);
      drawWrappedText(
        ctx,
        node.innerText || node.textContent || '',
        x,
        y + lineHeight,
        maxWidth,
        lineHeight
      );
    }

    ctx.restore();

    particles = createParticlesFromCanvas(w, h);
    return particles.length > 0;
  }

  /** @param {number} now */
  function animate(now) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const explodeMs = 150;
    const fadeMs = 240;
    const reassembleMs = 260;

    const tPhase = Math.max(0, now - phaseStart);

    ctx.clearRect(0, 0, canvasW, canvasH);

    if (phase === 'pending') {
      const k = Math.min(1, tPhase / explodeMs);
      for (const p of particles) {
        // fast burst then slow drift
        p.x += p.vx * (1.6 - 1.1 * k);
        p.y += p.vy * (1.6 - 1.1 * k);
        // subtle float
        p.x += (Math.random() - 0.5) * 0.6;
        p.y += (Math.random() - 0.5) * 0.6;
        p.a = 1;
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.a})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
    } else if (phase === 'success') {
      const k = Math.min(1, tPhase / fadeMs);
      const a = 1 - k;
      for (const p of particles) {
        p.x += p.vx * 0.15;
        p.y += p.vy * 0.15;
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
      if (k >= 1) {
        dissolving = false;
        deleting = false;
        phase = 'idle';
        clearCanvas();
        onRemoved && onRemoved();
        return;
      }
    } else if (phase === 'fail') {
      const k = Math.min(1, tPhase / reassembleMs);
      for (const p of particles) {
        // lerp back to origin
        p.x += (p.x0 - p.x) * (0.18 + 0.55 * k);
        p.y += (p.y0 - p.y) * (0.18 + 0.55 * k);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},1)`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
      if (k >= 1) {
        dissolving = false;
        deleting = false;
        phase = 'idle';
        deleteError = true;
        clearCanvas();
        return;
      }
    } else {
      return;
    }

    rafId = requestAnimationFrame(animate);
  }

  /** @param {MouseEvent} e */
  async function handleDeleteClick(e) {
    e.stopPropagation();
    if (deleting || dissolving) return;

    deleting = true;
    deleteError = false;

    // Start microinteraction immediately
    dissolving = true;
    phase = 'pending';
    phaseStart = performance.now();

    // ensure canvas is ready + particles captured
    await new Promise((r) => setTimeout(r, 0));
    const okInit = await initParticles();
    if (!okInit) {
      // fallback: if we can't build particles, don't block delete
      dissolving = false;
      deleting = false;
      return;
    }

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(animate);

    // Background API call; decide final state on result
    try {
      const ok = await (onDelete ? onDelete() : false);
      phase = ok ? 'success' : 'fail';
      phaseStart = performance.now();
    } catch (err) {
      console.error(err);
      phase = 'fail';
      phaseStart = performance.now();
    }
  }
</script>

<article
  bind:this={rootEl}
  class="relative p-6 card-3d-soft rounded-4xl group cursor-pointer"
  class:bg-white={phase === 'idle'}
  class:dark:bg-card-dark={phase === 'idle'}
  class:bg-transparent={phase !== 'idle'}
  class:border-transparent={phase !== 'idle'}
  class:shadow-none={phase !== 'idle'}
>
  <canvas
    bind:this={canvasEl}
    class="absolute inset-0 w-full h-full pointer-events-none"
    class:opacity-0={!dissolving}
    style="mix-blend-mode: normal;"
  ></canvas>

  <div class="flex items-start justify-between">
    <div class="space-y-4 flex-grow" class:opacity-0={dissolving}>
      <div class="space-y-0.5">
        <h2
          data-dissolve
          class="text-2xl font-fredoka font-bold tracking-tight text-slate-800 dark:text-white leading-tight break-words"
        >
          {word.text}
          <span
            class="text-[12px] font-medium text-slate-400 dark:text-text-muted align-middle ml-1.5 whitespace-nowrap"
            >{word.addedTime}</span
          >
        </h2>
        {#if word.ipa && !isPhrase}
          <p data-dissolve class="text-primary font-medium text-sm">{word.ipa}</p>
        {/if}
      </div>

      {#if word.translation}
        <div
          class="bg-orange-50 dark:bg-midnight-navy/40 rounded-2xl p-4 border border-orange-100 dark:border-white/5"
        >
          <p class="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
            Translation
          </p>
          <p data-dissolve class="text-primary font-fredoka font-bold text-lg leading-tight">
            {word.translation}
          </p>
        </div>
      {/if}

      <div class="space-y-1">
        <p
          class="text-[10px] font-bold text-slate-400 dark:text-text-muted uppercase tracking-tight"
        >
          Simple Definition
        </p>
        <p data-dissolve class="text-slate-600 dark:text-text-main font-medium leading-relaxed">
          {word.definition}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2 ml-4" class:opacity-0={dissolving}>
      <button
        onclick={handleDeleteClick}
        disabled={deleting || dissolving}
        class={deleteError
          ? 'w-10 h-10 flex items-center justify-center rounded-2xl border-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-red-500 border-red-500 bg-red-50'
          : 'w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 dark:text-text-muted border-2 border-slate-100 dark:border-white/10 hover:text-danger hover:border-danger/30 hover:bg-danger/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
      >
        <span class="material-symbols-outlined text-2xl">{deleteError ? 'error' : 'delete'}</span>
      </button>
      <button
        onclick={(e) => {
          e.stopPropagation();
        }}
        class="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 dark:text-text-muted border-2 border-slate-100 dark:border-white/10 hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all cursor-pointer"
      >
        <span class="material-symbols-outlined text-2xl">volume_up</span>
      </button>
    </div>
  </div>
</article>
