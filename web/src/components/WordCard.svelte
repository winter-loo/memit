<script>
  import { onDestroy } from 'svelte';

  let { word, onDelete, onRemoved } = $props();

  let isPhrase = $derived((word.text || '').trim().split(/\s+/).length >= 2);

  let rootEl = $state(/** @type {HTMLElement | null} */ (null));
  let canvasEl = $state(/** @type {HTMLCanvasElement | null} */ (null));

  let deleting = $state(false);
  let dissolving = $state(false);

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
    const particles = [];
    const step = 6; // lower => more particles
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const base = (y * w + x) * 4;
        const a = data[base + 3];
        if (a > 20) {
          const r = data[base];
          const g = data[base + 1];
          const b = data[base + 2];
          const angle = (Math.random() * Math.PI) / 1.1 - Math.PI / 2.2;
          const speed = 0.6 + Math.random() * 1.8;
          particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (0.4 + Math.random() * 0.8),
            a: 1,
            r,
            g,
            b
          });
        }
      }
    }
    return particles;
  }

  async function startDissolve() {
    if (!rootEl) return;
    // ensure canvas is mounted
    if (!canvasEl) return;

    const rect = rootEl.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    canvasEl.width = w;
    canvasEl.height = h;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

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

    // Re-read pixels at device resolution
    const pctx = canvasEl.getContext('2d');
    if (!pctx) return;

    const particles = createParticlesFromCanvas(w, h);

    // Animate (dissolving already true)

    const duration = 520;
    const start = performance.now();

    /** @param {number} now */
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      pctx.clearRect(0, 0, w, h);

      const fade = 1 - t;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // gravity
        p.a = fade;

        pctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.a})`;
        pctx.fillRect(p.x, p.y, 2, 2);
      }

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        dissolving = false;
        deleting = false;
        onRemoved && onRemoved();
      }
    };

    rafId = requestAnimationFrame(tick);
  }

  /** @param {MouseEvent} e */
  async function handleDeleteClick(e) {
    e.stopPropagation();
    if (deleting || dissolving) return;

    deleting = true;

    // Wait for API result; dissolve only on success
    try {
      const ok = await (onDelete ? onDelete() : false);
      if (!ok) {
        deleting = false;
        return;
      }
      // mount canvas + hide text before sampling/animating
      dissolving = true;
      // allow DOM to update so bind:this is set
      await new Promise((r) => setTimeout(r, 0));
      await startDissolve();
    } catch {
      deleting = false;
    }
  }
</script>

<article
  bind:this={rootEl}
  class="relative p-6 card-3d-soft rounded-4xl bg-white dark:bg-card-dark group cursor-pointer"
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
        class="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 dark:text-text-muted border-2 border-slate-100 dark:border-white/10 hover:text-danger hover:border-danger/30 hover:bg-danger/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span class="material-symbols-outlined text-2xl">delete</span>
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
