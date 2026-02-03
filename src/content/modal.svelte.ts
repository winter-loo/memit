import { mount, unmount } from 'svelte';
import Modal from '../components/Modal.svelte';
import appCss from '../app.css?inline';
import { countWords } from '../lib/text-utils';
import type { DictionaryResponse } from '../lib/explanation/types';

console.log('Screen Text Reader: Modal content script loaded.');

let overlayHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let contentContainer: HTMLDivElement | null = null;
let svelteApp: Record<string, unknown> | null = null;
let currentRequestId = 0;

interface ModalProps {
  result?: DictionaryResponse;
  isLoading: boolean;
  error: string;
  isProviderError: boolean;
  text: string;
  modelId: string;
  openRouterApiKey: string;
  geminiApiKey: string;
  responseTimeout: number;
  isSaving: boolean;
  isRetrying: boolean;
  saveError: string;
  isSaved: boolean;
  onClose: () => void;
  onSave?: () => void;
  onRetry: (
    newModelId: string,
    apiKeys: { openRouter?: string; gemini?: string },
    newText?: string
  ) => void;
}

// Reactive state for modal props
const modalProps = $state<ModalProps>({
  result: undefined,
  isLoading: false,
  error: '',
  isProviderError: false,
  text: '',
  modelId: 'memcool:gemini-2.5-flash-lite',
  openRouterApiKey: '',
  geminiApiKey: '',
  responseTimeout: 5,
  isSaving: false,
  isRetrying: false,
  saveError: '',
  isSaved: false,
  onClose: () => hideModal(),
  onRetry: (
    newModelId: string,
    apiKeys: { openRouter?: string; gemini?: string },
    newText?: string
  ) => {
    const textToUse = newText !== undefined ? newText : modalProps.text;
    const wordCount = countWords(textToUse);
    const maxWords = 20;

    if (wordCount > maxWords) {
      modalProps.error = `Selection too long (${wordCount} words). Please select less than ${maxWords} words.`;
      modalProps.isProviderError = false;
      modalProps.text = textToUse;
      return;
    }

    modalProps.isRetrying = true;
    modalProps.error = '';

    const updates: Record<string, string> = { modelId: newModelId };
    if (apiKeys.openRouter !== undefined) updates.openRouterApiKey = apiKeys.openRouter;
    if (apiKeys.gemini !== undefined) updates.geminiApiKey = apiKeys.gemini;

    chrome.storage.sync.set(updates, () => {
      setTimeout(() => {
        modalProps.isRetrying = false;
        modalProps.isLoading = true;
        modalProps.modelId = newModelId;
        modalProps.text = textToUse;

        if (apiKeys.openRouter !== undefined) modalProps.openRouterApiKey = apiKeys.openRouter;
        if (apiKeys.gemini !== undefined) modalProps.geminiApiKey = apiKeys.gemini;

        if (textToUse) fetchExplanation(textToUse, newModelId);
      }, 1500);
    });
  },
});

function ensureOverlayHost() {
  if (!overlayHost || !document.body.contains(overlayHost)) {
    if (overlayHost) overlayHost.remove();

    overlayHost = document.createElement('div');
    overlayHost.id = 'mem-it-modal-host';
    overlayHost.style.position = 'absolute';
    overlayHost.style.zIndex = '2147483647';
    overlayHost.style.pointerEvents = 'auto';
    overlayHost.style.display = 'none';

    // 1. Create Shadow Root
    shadowRoot = overlayHost.attachShadow({ mode: 'open' });

    // 2. Inject global app styles + Reset into Shadow DOM
    const globalStyleTag = document.createElement('style');
    globalStyleTag.textContent = `
      :host {
        all: initial;
        display: block;
        font-family: 'Lexend', sans-serif;
      }
      @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
      ${appCss}
    `;
    shadowRoot.appendChild(globalStyleTag);

    // 3. Create container for Svelte app
    contentContainer = document.createElement('div');
    contentContainer.className = 'memit-root';
    shadowRoot.appendChild(contentContainer);

    document.body.appendChild(overlayHost);

    // Initial storage sync
    chrome.storage.sync.get(
      ['theme', 'modelId', 'openRouterApiKey', 'geminiApiKey', 'responseTimeout'],
      (result: Record<string, string | number | boolean | undefined>) => {
        if (result.theme === 'light') contentContainer?.classList.add('memit-light');
        if (result.modelId) modalProps.modelId = result.modelId as string;
        if (result.openRouterApiKey)
          modalProps.openRouterApiKey = result.openRouterApiKey as string;
        if (result.geminiApiKey) modalProps.geminiApiKey = result.geminiApiKey as string;
        if (result.responseTimeout) modalProps.responseTimeout = result.responseTimeout as number;
      }
    );
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.theme && contentContainer) {
      if (changes.theme.newValue === 'light') {
        contentContainer.classList.add('memit-light');
      } else {
        contentContainer.classList.remove('memit-light');
      }
    }
    if (changes.modelId) modalProps.modelId = changes.modelId.newValue as string;
    if (changes.openRouterApiKey)
      modalProps.openRouterApiKey = changes.openRouterApiKey.newValue as string;
    if (changes.geminiApiKey) modalProps.geminiApiKey = changes.geminiApiKey.newValue as string;
    if (changes.responseTimeout)
      modalProps.responseTimeout = changes.responseTimeout.newValue as number;
  }
});

export function openModal(text: string) {
  console.log('Opening modal for:', text);
  ensureOverlayHost();

  const wordCount = countWords(text);
  const maxWords = 20;

  overlayHost!.style.display = 'block';
  overlayHost!.style.visibility = 'hidden';
  overlayHost!.style.left = '-9999px';

  if (svelteApp) {
    unmount(svelteApp);
  }
  contentContainer!.innerHTML = '';

  // Reset modal state
  modalProps.result = undefined;
  modalProps.text = text;
  modalProps.error = '';
  modalProps.isLoading = false;
  modalProps.isRetrying = false;
  modalProps.isSaved = false;
  modalProps.isSaving = false;
  modalProps.saveError = '';

  if (wordCount > maxWords) {
    modalProps.error = `Selection too long (${wordCount} words). Please select less than ${maxWords} words.`;
    modalProps.isProviderError = false;
  } else {
    modalProps.isLoading = true;
  }

  svelteApp = mount(Modal, {
    target: contentContainer!,
    props: modalProps,
  });

  setTimeout(() => {
    positionModal();
    overlayHost!.style.visibility = 'visible';
  }, 0);

  if (wordCount <= maxWords) {
    fetchExplanation(text, modalProps.modelId);
  }
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
    if (rect.right + modalWidth + margin < viewportWidth) {
      left = rect.right + margin;
    } else if (rect.left - modalWidth - margin > 0) {
      left = rect.left - modalWidth - margin;
    } else {
      left = (viewportWidth - modalWidth) / 2;
    }
    left += window.scrollX;
    const selectionCenterY = rect.top + rect.height / 2;
    const vPct = Math.max(0, Math.min(1, selectionCenterY / viewportHeight));
    top = selectionCenterY - vPct * modalHeight + window.scrollY;
    const minTop = margin + window.scrollY;
    const maxTop = viewportHeight - modalHeight - margin + window.scrollY;
    top = Math.max(minTop, Math.min(maxTop, top));
  } else {
    left = (viewportWidth - modalWidth) / 2 + window.scrollX;
    top = (viewportHeight - modalHeight) / 2 + window.scrollY;
  }

  overlayHost!.style.left = `${left}px`;
  overlayHost!.style.top = `${top}px`;
}

async function fetchExplanation(text: string, currentModelId: string) {
  const requestId = ++currentRequestId;

  chrome.runtime.sendMessage(
    { type: 'EXPLAIN_TEXT', text, modelId: currentModelId },
    (response) => {
      // Ignore if a newer request has been started
      if (requestId !== currentRequestId) return;
      if (!svelteApp || !contentContainer) return;

      if (response?.error) {
        modalProps.isLoading = false;
        modalProps.error = response.error;
        modalProps.isProviderError = true;
      } else if (response?.result) {
        modalProps.isLoading = false;
        modalProps.result = response.result;

        // Setup save handler
        modalProps.onSave = () => {
          const currentResult = modalProps.result;
          if (!currentResult) return;

          modalProps.isSaving = true;
          chrome.runtime.sendMessage(
            {
              type: 'SAVE_TO_ANKI',
              word: currentResult.word,
              explanation: currentResult,
            },
            (saveResponse) => {
              modalProps.isSaving = false;
              if (saveResponse?.error) {
                modalProps.saveError = saveResponse.error;
              } else {
                modalProps.isSaved = true;
              }
            }
          );
        };
      } else {
        modalProps.isLoading = false;
        modalProps.error = 'Failed to get an explanation. Please try again later.';
        modalProps.isProviderError = true;
      }
    }
  );
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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'OPEN_MODAL') {
    openModal(message.text);
  }
});

document.addEventListener('mousedown', (e) => {
  if (overlayHost && overlayHost.style.display === 'block') {
    // For Shadow DOM, check if the click target was outside our host
    const path = e.composedPath();
    if (!path.includes(overlayHost)) {
      hideModal();
    }
  }
});
