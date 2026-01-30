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
let activeSessionId = 0;
let sessionPending = 0;
let sessionSuccessCount = 0;
let sessionLastError = '';

interface ResponseEntry {
  modelId: string;
  status: 'success' | 'error';
  result?: DictionaryResponse;
  error?: string;
  responseTimeMs: number;
  receivedAt: number;
}

interface QueryState {
  text: string;
  responses: ResponseEntry[];
  activeResponseIndex: number;
  result?: DictionaryResponse;
  error: string;
  isProviderError: boolean;
  isSaved: boolean;
  saveError: string;
}

const historyStack: QueryState[] = [];
const forwardStack: QueryState[] = [];

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
  responses: ResponseEntry[];
  activeResponseIndex: number;
  pendingResponses: number;
  pendingModelIds: string[];
  onSelectResponse?: (index: number) => void;
  onClose: () => void;
  onSave?: () => void;
  onRetry: (
    newModelId: string,
    apiKeys: { openRouter?: string; gemini?: string },
    newText?: string
  ) => void;
  onNewQuery: (text: string) => void;
  onBack?: () => void;
  onForward?: () => void;
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
  responses: [],
  activeResponseIndex: 0,
  pendingResponses: 0,
  pendingModelIds: [],
  onSelectResponse: (index: number) => {
    if (index < 0 || index >= modalProps.responses.length) return;
    const entry = modalProps.responses[index];
    modalProps.activeResponseIndex = index;
    modalProps.result = entry?.status === 'success' ? entry.result : undefined;
    if (entry?.status === 'error') {
      modalProps.error = entry.error ?? 'Request failed.';
      modalProps.isProviderError = true;
    } else {
      modalProps.error = '';
      modalProps.isProviderError = false;
    }
  },
  onClose: () => hideModal(),
  onRetry: (
    newModelId: string,
    apiKeys: { openRouter?: string; gemini?: string },
    newText?: string
  ) => {
    const previousText = modalProps.text;
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
      modalProps.isRetrying = false;
      modalProps.isLoading = true;
      modalProps.modelId = newModelId;
      modalProps.text = textToUse;

      if (apiKeys.openRouter !== undefined) modalProps.openRouterApiKey = apiKeys.openRouter;
      if (apiKeys.gemini !== undefined) modalProps.geminiApiKey = apiKeys.gemini;

      if (newText !== undefined && newText !== previousText) {
        startNewSession();
      }
      if (textToUse) fetchExplanation(textToUse, newModelId);
    });
  },
  onNewQuery: (newText: string) => {
    const wordCount = countWords(newText);
    const maxWords = 20;

    // Capture current state into history
    const currentState = captureCurrentState();
    historyStack.push(currentState);

    // Clear forward stack on new query
    forwardStack.length = 0;

    updateNavigationHandlers();

    // Start fresh
    startNewSession();
    modalProps.text = newText;

    if (wordCount > maxWords) {
      modalProps.error = `Selection too long (${wordCount} words). Please select less than ${maxWords} words.`;
      modalProps.isProviderError = false;
    } else {
      modalProps.isLoading = true;
      fetchExplanation(newText, modalProps.modelId);
    }
  },
});

function captureCurrentState(): QueryState {
  return {
    text: modalProps.text,
    responses: [...modalProps.responses],
    activeResponseIndex: modalProps.activeResponseIndex,
    result: modalProps.result,
    error: modalProps.error,
    isProviderError: modalProps.isProviderError,
    isSaved: modalProps.isSaved,
    saveError: modalProps.saveError,
  };
}

function updateNavigationHandlers() {
  modalProps.onBack = historyStack.length > 0 ? handleBack : undefined;
  modalProps.onForward = forwardStack.length > 0 ? handleForward : undefined;
}

function restoreState(state: QueryState) {
  // Increment sessionId to cancel any pending requests
  activeSessionId += 1;

  modalProps.text = state.text;
  modalProps.responses = state.responses;
  modalProps.activeResponseIndex = state.activeResponseIndex;
  modalProps.result = state.result;
  modalProps.error = state.error;
  modalProps.isProviderError = state.isProviderError;
  modalProps.isSaved = state.isSaved;
  modalProps.saveError = state.saveError;
  modalProps.isLoading = false;
  modalProps.pendingResponses = 0;
  modalProps.pendingModelIds = [];

  updateNavigationHandlers();
}

function handleBack() {
  const previousState = historyStack.pop();
  if (previousState) {
    const currentState = captureCurrentState();
    forwardStack.push(currentState);
    restoreState(previousState);
  }
}

function handleForward() {
  const nextState = forwardStack.pop();
  if (nextState) {
    const currentState = captureCurrentState();
    historyStack.push(currentState);
    restoreState(nextState);
  }
}

function startNewSession() {
  activeSessionId += 1;
  sessionPending = 0;
  sessionSuccessCount = 0;
  sessionLastError = '';
  modalProps.responses = [];
  modalProps.activeResponseIndex = 0;
  modalProps.pendingResponses = 0;
  modalProps.pendingModelIds = [];
  modalProps.result = undefined;
  modalProps.error = '';
  modalProps.isProviderError = false;
  modalProps.isSaved = false;
  modalProps.isSaving = false;
  modalProps.saveError = '';
}

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
  startNewSession();
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
  const sessionId = activeSessionId;
  sessionPending += 1;
  modalProps.pendingResponses = sessionPending;
  if (!modalProps.pendingModelIds.includes(currentModelId)) {
    modalProps.pendingModelIds = [...modalProps.pendingModelIds, currentModelId];
  }
  const requestStart = performance.now();

  chrome.runtime.sendMessage(
    { type: 'EXPLAIN_TEXT', text, modelId: currentModelId },
    (response) => {
      if (sessionId !== activeSessionId) return;
      if (!svelteApp || !contentContainer) return;
      sessionPending = Math.max(0, sessionPending - 1);
      modalProps.pendingResponses = sessionPending;
      modalProps.pendingModelIds = modalProps.pendingModelIds.filter((id) => id !== currentModelId);

      if (response?.error) {
        const responseTimeMs = Math.round(performance.now() - requestStart);
        sessionLastError = response.error;
        const entry: ResponseEntry = {
          modelId: currentModelId,
          status: 'error',
          error: response.error,
          responseTimeMs,
          receivedAt: Date.now(),
        };

        const existingIndex = modalProps.responses.findIndex((r) => r.modelId === currentModelId);
        if (existingIndex !== -1) {
          modalProps.responses[existingIndex] = entry;
          modalProps.activeResponseIndex = existingIndex;
        } else {
          modalProps.responses = [...modalProps.responses, entry];
          modalProps.activeResponseIndex = modalProps.responses.length - 1;
        }

        modalProps.result = undefined;
        modalProps.isLoading = false;
        modalProps.error = response.error;
        modalProps.isProviderError = true;

        if (sessionSuccessCount === 0 && sessionPending === 0) {
          modalProps.isLoading = false;
          modalProps.error = sessionLastError;
          modalProps.isProviderError = true;
        }
      } else if (response?.result) {
        const responseTimeMs = Math.round(performance.now() - requestStart);
        const entry: ResponseEntry = {
          modelId: currentModelId,
          status: 'success',
          result: response.result,
          responseTimeMs,
          receivedAt: Date.now(),
        };
        sessionSuccessCount += 1;
        modalProps.isLoading = false;

        const existingIndex = modalProps.responses.findIndex((r) => r.modelId === currentModelId);
        let newIndex = -1;
        if (existingIndex !== -1) {
          modalProps.responses[existingIndex] = entry;
          newIndex = existingIndex;
        } else {
          modalProps.responses = [...modalProps.responses, entry];
          newIndex = modalProps.responses.length - 1;
        }

        // Only switch to this new result if we don't already have a successful result displayed
        if (!modalProps.result) {
          modalProps.activeResponseIndex = newIndex;
          modalProps.result = response.result;
          modalProps.isLoading = false;
          modalProps.error = '';
          modalProps.isProviderError = false;
        } else {
          // If we are already showing a result, just update the list (which is reactive)
          // The user can manually switch if they want.
          // We might want to ensure isLoading is false if all pending are done?
          // The sessionPending logic handles the spinner in the status bar if we add that later,
          // but for the main UI, if we have a result, we are not "loading" in the main view.
        }

        // Trace minimum response time and set best model
        const successfulResponses = modalProps.responses.filter((r) => r.status === 'success');
        if (successfulResponses.length > 0) {
          const fastest = successfulResponses.reduce((min, curr) =>
            curr.responseTimeMs < min.responseTimeMs ? curr : min
          );
          chrome.storage.sync.get(['modelId'], (data) => {
            if (data.modelId !== fastest.modelId) {
              console.log(
                `Switching default model to ${fastest.modelId} (${fastest.responseTimeMs}ms)`
              );
              chrome.storage.sync.set({ modelId: fastest.modelId });
            }
          });
        }

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
        const responseTimeMs = Math.round(performance.now() - requestStart);
        sessionLastError = 'Failed to get an explanation. Please try again later.';
        const entry: ResponseEntry = {
          modelId: currentModelId,
          status: 'error',
          error: sessionLastError,
          responseTimeMs,
          receivedAt: Date.now(),
        };

        const existingIndex = modalProps.responses.findIndex((r) => r.modelId === currentModelId);
        if (existingIndex !== -1) {
          modalProps.responses[existingIndex] = entry;
          modalProps.activeResponseIndex = existingIndex;
        } else {
          modalProps.responses = [...modalProps.responses, entry];
          modalProps.activeResponseIndex = modalProps.responses.length - 1;
        }

        modalProps.result = undefined;
        modalProps.isLoading = false;
        modalProps.error = sessionLastError;
        modalProps.isProviderError = true;

        if (sessionSuccessCount === 0 && sessionPending === 0) {
          modalProps.isLoading = false;
          modalProps.error = sessionLastError;
          modalProps.isProviderError = true;
        }
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
