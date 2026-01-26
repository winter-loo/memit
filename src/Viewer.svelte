<script lang="ts">
  import { onMount } from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import 'pdfjs-dist/web/pdf_viewer.css';

  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  let container: HTMLElement;
  let canvas: HTMLCanvasElement;
  let textLayerDiv: HTMLDivElement;

  async function loadPDF(url: string) {
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    
    const viewport = page.getViewport({ scale: 1.5 });
    const context = canvas.getContext('2d');
    if (!context) return;

    // eslint-disable-next-line svelte/no-dom-manipulating
    canvas.height = viewport.height;
    // eslint-disable-next-line svelte/no-dom-manipulating
    canvas.width = viewport.width;

    // Render canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    // Render text layer
    const textContent = await page.getTextContent();
    textLayerDiv.innerHTML = '';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;

    // @ts-expect-error - PDF.js v5 API call
    await pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport: viewport,
    }).promise;
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get('file') || '/test-assets/sample.pdf';
    loadPDF(fileUrl).catch(console.error);
  });
</script>

<div class="viewer-layout">
  <header>
    <h1>PDF Viewer</h1>
  </header>
  <main bind:this={container} data-testid="pdf-viewer-container" id="viewerContainer">
    <div class="pdf-page-container">
      <canvas bind:this={canvas}></canvas>
      <div bind:this={textLayerDiv} class="textLayer"></div>
    </div>
  </main>
</div>

<style>
  .viewer-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background-color: var(--bg-deep);
  }

  header {
    background: var(--bg-dark);
    color: var(--text-main);
    padding: 0.5rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    height: 60px;
  }

  main {
    flex: 1;
    overflow: auto;
    background: var(--bg-deep);
    padding: 2rem;
    display: flex;
    justify-content: center;
  }

  .pdf-page-container {
    position: relative;
    box-shadow: var(--shadow-lg);
    background: white; /* Keep white for PDF content */
  }

  h1 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--primary-color);
  }

  /* Ensure text layer aligns with canvas */
  :global(.textLayer) {
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0;
    line-height: 1.0;
    white-space: pre;
    cursor: text;
    transform-origin: 0 0;
  }
</style>