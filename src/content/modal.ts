import { mount, unmount } from 'svelte';
import Modal from '../components/Modal.svelte';
import appCss from '../app.css?inline';
import { countWords } from '../lib/text-utils';

console.log('Screen Text Reader: Modal content script loaded.');

let overlayHost: HTMLDivElement | null = null;
let contentContainer: HTMLDivElement | null = null;
let svelteApp: Record<string, unknown> | null = null;

function ensureOverlayHost() {
  if (!overlayHost || !document.body.contains(overlayHost)) {
    if (overlayHost) overlayHost.remove();

    overlayHost = document.createElement('div');
    overlayHost.id = 'mem-it-modal-host';
    overlayHost.style.position = 'absolute';
    overlayHost.style.zIndex = '2147483647';
    overlayHost.style.pointerEvents = 'auto';
    overlayHost.style.display = 'none';

    // Use a regular div instead of shadow DOM to allow Svelte styles to work.
    // Svelte's scoped styles are injected into the document head, which shadow DOM blocks.
    if (!document.getElementById('memit-global-styles')) {
      const styleTag = document.createElement('style');
      styleTag.id = 'memit-global-styles';
      styleTag.textContent = appCss;
      document.head.appendChild(styleTag);

      const fontStyle = document.createElement('style');
      fontStyle.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
      `;
      document.head.appendChild(fontStyle);
    }

    // Create a container for the Svelte app
    contentContainer = document.createElement('div');
    contentContainer.className = 'memit-root';

    // Apply initial theme
    chrome.storage.sync.get(['theme'], (result) => {
      const theme = result.theme ?? 'light';
      if (theme === 'light') {
        contentContainer?.classList.add('memit-light');
      }
    });

    overlayHost.appendChild(contentContainer);

    document.body.appendChild(overlayHost);
  }
}

// Listen for storage changes to update theme in real-time
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.theme && contentContainer) {
    if (changes.theme.newValue === 'light') {
      contentContainer.classList.add('memit-light');
    } else {
      contentContainer.classList.remove('memit-light');
    }
  }
});

export function openModal(text: string) {
  console.log('Opening modal for:', text);
  ensureOverlayHost();

  const wordCount = countWords(text);
  const maxWords = 20;

  // Reset display to block but keep invisible to measure height
  overlayHost!.style.display = 'block';
  overlayHost!.style.visibility = 'hidden';
  overlayHost!.style.left = '-9999px'; // Move off-screen just in case

  if (svelteApp) {
    unmount(svelteApp);
  }

  // Clear previous content
  contentContainer!.innerHTML = '';

  if (wordCount > maxWords) {
    svelteApp = mount(Modal, {
      target: contentContainer!,
      props: {
        error: `Selection too long (${wordCount} words). Please select less than ${maxWords} words.`,
        onClose: () => hideModal()
      }
    });
    // Still need to position the "error" modal
    setTimeout(() => {
      positionModal();
      overlayHost!.style.visibility = 'visible';
    }, 0);
    return;
  }

  // Mount Svelte Modal with loading state
  svelteApp = mount(Modal, {
    target: contentContainer!,
    props: {
      isLoading: true,
      onClose: () => hideModal()
    }
  });

  // Small delay to allow Svelte to render and CSS to apply
  setTimeout(() => {
    positionModal();
    overlayHost!.style.visibility = 'visible';
  }, 0);

  fetchExplanation(text);
}

function positionModal() {
  const selection = window.getSelection();
  let left = 0;
  let top = 0;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const modalWidth = contentContainer!.offsetWidth || 440;
  const modalHeight = contentContainer!.offsetHeight || 600;
  const margin = 20;

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // 1. Horizontal positioning (Prefer Right, then Left)
    if (rect.right + modalWidth + margin < viewportWidth) {
      left = rect.right + margin;
    } else if (rect.left - modalWidth - margin > 0) {
      left = rect.left - modalWidth - margin;
    } else {
      // Fallback to center if no space on either side
      left = (viewportWidth - modalWidth) / 2;
    }
    left += window.scrollX;

    // 2. Vertical positioning (Percentage-based alignment)
    // Compute the percentage position of the selection in the viewport
    const selectionCenterY = rect.top + rect.height / 2;
    const vPct = Math.max(0, Math.min(1, selectionCenterY / viewportHeight));

    // Use the percentage to position the modal so it stays visible
    // vPct = 0 (top) -> modalTop = selectionCenterY
    // vPct = 1 (bottom) -> modalTop = selectionCenterY - modalHeight
    top = selectionCenterY - (vPct * modalHeight) + window.scrollY;

    // Final boundary check to ensure visibility
    const minTop = margin + window.scrollY;
    const maxTop = viewportHeight - modalHeight - margin + window.scrollY;
    top = Math.max(minTop, Math.min(maxTop, top));
  } else {
    // Fallback to center if no selection
    left = (viewportWidth - modalWidth) / 2 + window.scrollX;
    top = (viewportHeight - modalHeight) / 2 + window.scrollY;
  }

  overlayHost!.style.left = `${left}px`;
  overlayHost!.style.top = `${top}px`;
}

async function fetchExplanation(text: string) {
  chrome.runtime.sendMessage({ type: 'EXPLAIN_TEXT', text }, (response) => {
    if (!svelteApp || !contentContainer) return;

    const mountError = (err: string) => {
      unmount(svelteApp!);
      contentContainer!.innerHTML = '';
      svelteApp = mount(Modal, {
        target: contentContainer!,
        props: {
          error: err,
          onClose: () => hideModal()
        }
      });
    };

    if (response?.error) {
      mountError(response.error);
    } else if (response?.result) {
      unmount(svelteApp);
      contentContainer.innerHTML = '';
      svelteApp = mount(Modal, {
        target: contentContainer,
        props: {
          result: response.result,
          onClose: () => hideModal(),
          onSave: () => {
            const currentResult = response.result;
            if (!currentResult) return;

            // Re-mount with saving state
            unmount(svelteApp!);
            contentContainer!.innerHTML = '';
            svelteApp = mount(Modal, {
              target: contentContainer!,
              props: {
                result: currentResult,
                isSaving: true,
                onClose: () => hideModal(),
                onSave: () => {}
              }
            });

            chrome.runtime.sendMessage({
              type: 'SAVE_TO_ANKI',
              word: currentResult.word,
              explanation: currentResult
            }, (saveResponse) => {
              if (!svelteApp || !contentContainer) return;
              unmount(svelteApp);
              contentContainer.innerHTML = '';

              if (saveResponse?.error) {
                svelteApp = mount(Modal, {
                  target: contentContainer,
                  props: {
                    result: currentResult,
                    saveError: saveResponse.error,
                    onClose: () => hideModal(),
                    onSave: () => { /* Retry logic could go here */ }
                  }
                });
              } else {
                svelteApp = mount(Modal, {
                  target: contentContainer,
                  props: {
                    result: currentResult,
                    isSaved: true,
                    onClose: () => hideModal(),
                    onSave: () => {}
                  }
                });
              }
            });
          }
        }
      });
    } else {
      // Fallback for unexpected or empty responses
      mountError('Failed to get an explanation. Please try again later.');
    }
  });
}

export function hideModal() {
  if (overlayHost) {
    overlayHost.style.display = 'none';
    if (svelteApp) {
      unmount(svelteApp);
      svelteApp = null;
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  console.log('Modal content script received message:', message);
  if (message.type === 'OPEN_MODAL') {
    openModal(message.text);
  }
});

// Close modal on click outside
document.addEventListener('mousedown', (e) => {
  if (overlayHost && overlayHost.style.display === 'block') {
    if (!overlayHost.contains(e.target as Node)) {
      hideModal();
    }
  }
});
