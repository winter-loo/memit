import { MemCoolExplainer } from './lib/explanation/providers/memcool';
import { OpenRouterExplainer } from './lib/explanation/providers/openrouter';
import { GeminiExplainer } from './lib/explanation/providers/gemini';
import { AnkiClient } from './lib/anki/client';
import { countWords } from './lib/text-utils';

const memcool = new MemCoolExplainer();
const openrouter = new OpenRouterExplainer();
const gemini = new GeminiExplainer();
const anki = new AnkiClient();

const DEFAULT_MEMSTORE_URL = 'https://memstore.ldd.cool';
const DEFAULT_MEMIT_URL = 'https://memit.ldd.cool';

function normalizeBaseUrl(url: string): string {
  return (url || '').replace(/\/$/, '');
}

function openAuthTab(authUrl: string) {
  const normalized = normalizeBaseUrl(authUrl || DEFAULT_MEMIT_URL);
  if (!normalized) return;

  // Mark auth as pending first (so the content script can start immediately without racing the tab create).
  chrome.storage.local.set({ ankiAuthPending: true, ankiAuthPendingSince: Date.now() });

  let url = normalized;
  try {
    const u = new URL(normalized);
    u.searchParams.set('memit_ext_auth', '1');
    url = u.toString();
  } catch {
    // Fall back to the provided string if it's not a valid URL.
  }

  chrome.tabs.create({ url });
}

function isAuthErrorMessage(msg: string): boolean {
  return (
    msg.includes('Auth Error: 401') ||
    msg.includes('Auth Error: 403') ||
    msg.includes('Missing Bearer token')
  );
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'mem-it',
    title: 'Mem it',
    contexts: ['selection'],
  });

  // Initialize default settings
  chrome.storage.sync.get(
    ['theme', 'modelId', 'ankiBackendUrl', 'ankiAuthUrl'],
    (result: {
      theme?: string;
      modelId?: string;
      ankiBackendUrl?: string;
      ankiAuthUrl?: string;
    }) => {
      if (!result.theme) {
        chrome.storage.sync.set({ theme: 'light' });
      }
      if (!result.modelId) {
        chrome.storage.sync.set({ modelId: 'memcool:gemini-2.5-flash-lite' });
      }
      const currentBackendUrl = normalizeBaseUrl(result.ankiBackendUrl || '');
      // Migration: older builds used memit.ldd.cool as the backend default. memit.ldd.cool is frontend-only.
      if (!currentBackendUrl || currentBackendUrl === DEFAULT_MEMIT_URL) {
        chrome.storage.sync.set({ ankiBackendUrl: DEFAULT_MEMSTORE_URL });
      }
      if (!result.ankiAuthUrl) {
        chrome.storage.sync.set({ ankiAuthUrl: DEFAULT_MEMIT_URL });
      }
    }
  );
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'mem-it' && tab?.id) {
    console.log('Mem it clicked:', info.selectionText);

    // Send message to content script to open modal
    chrome.tabs.sendMessage(tab.id, {
      type: 'OPEN_MODAL',
      text: info.selectionText,
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXPLAIN_TEXT') {
    const wordCount = countWords(message.text);
    if (wordCount > 20) {
      sendResponse({ error: `Text too long (${wordCount} words). Maximum is 20 words.` });
      return false;
    }

    chrome.storage.sync.get(
      ['modelId', 'openRouterApiKey', 'geminiApiKey', 'ankiBackendUrl'],
      (settings: {
        modelId?: string;
        openRouterApiKey?: string;
        geminiApiKey?: string;
        ankiBackendUrl?: string;
      }) => {
        const modelId = settings.modelId || 'memcool:gemini-2.5-flash-lite';
        const ankiBackendUrl = settings.ankiBackendUrl || DEFAULT_MEMSTORE_URL;

        memcool.setBaseUrl(ankiBackendUrl);

        const openRouterApiKey = settings.openRouterApiKey;

        const geminiApiKey = settings.geminiApiKey;

        let explainer;

        let actualModelId;

        const options: { apiKey?: string; modelId?: string } = {};

        if (modelId.startsWith('openrouter:')) {
          explainer = openrouter;

          actualModelId = modelId.replace('openrouter:', '');

          options.apiKey = openRouterApiKey;
        } else if (modelId.startsWith('gemini:')) {
          explainer = gemini;

          actualModelId = modelId.replace('gemini:', '');

          options.apiKey = geminiApiKey;
        } else if (modelId.startsWith('memcool:')) {
          explainer = memcool;

          actualModelId = modelId.replace('memcool:', '');
        } else {
          // Default to memcool for any legacy/unprefixed IDs

          explainer = memcool;

          actualModelId = modelId;
        }

        explainer
          .explain(message.text, { ...options, modelId: actualModelId })

          .then((result) => sendResponse({ result }))

          .catch((error) => {
            console.error('Explanation error:', error);

            sendResponse({ error: error.message });
          });
      }
    );
    return true;
  } else if (message.type === 'OPEN_SIDE_PANEL') {
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    }
  } else if (message.type === 'ANKI_AUTH_TOKEN') {
    // Received from auth-bridge content script on the configured auth origin (default: memit.ldd.cool)
    const token = message.token;
    if (typeof token === 'string' && token.length > 0) {
      const toSet: Record<string, unknown> = { ankiAuthToken: token };
      const toRemove: string[] = [];

      if (typeof message.fallbackToken === 'string' && message.fallbackToken.length > 0) {
        toSet.ankiAuthTokenFallback = message.fallbackToken;
      } else {
        toRemove.push('ankiAuthTokenFallback');
      }

      if (typeof message.tokenType === 'string' && message.tokenType.length > 0) {
        toSet.ankiAuthTokenType = message.tokenType;
      } else {
        toRemove.push('ankiAuthTokenType');
      }

      chrome.storage.local.set(toSet);
      if (toRemove.length > 0) {
        chrome.storage.local.remove(toRemove);
      }

      // Clear pending auth state (and clean up legacy keys if present).
      chrome.storage.local.remove([
        'ankiAuthPending',
        'ankiAuthPendingSince',
        'ankiAuthPendingTabId',
      ]);

      sendResponse({ success: true });
    } else {
      sendResponse({ error: 'Missing token' });
    }
    return true;
  } else if (message.type === 'SAVE_TO_ANKI') {
    const rawJson = JSON.stringify(message.explanation);

    chrome.storage.sync.get(
      ['ankiBackendUrl', 'ankiAuthUrl'],
      (syncResult: { ankiBackendUrl?: string; ankiAuthUrl?: string }) => {
        const ankiBackendUrl = syncResult.ankiBackendUrl || DEFAULT_MEMSTORE_URL;
        const ankiAuthUrl = syncResult.ankiAuthUrl || DEFAULT_MEMIT_URL;
        anki.setBaseUrl(ankiBackendUrl);

        const openLoginTab = () => openAuthTab(ankiAuthUrl);

        chrome.storage.local.get(
          ['ankiAuthToken', 'ankiAuthTokenFallback'],
          async (result: { ankiAuthToken?: string; ankiAuthTokenFallback?: string }) => {
            const primaryToken =
              typeof result.ankiAuthToken === 'string' ? result.ankiAuthToken : '';
            const fallbackToken =
              typeof result.ankiAuthTokenFallback === 'string' ? result.ankiAuthTokenFallback : '';

            const hasPrimary = primaryToken.length > 0;
            const hasFallback = fallbackToken.length > 0;
            if (!hasPrimary && !hasFallback) {
              openLoginTab();
              sendResponse({
                error:
                  'Not signed in to Anki service. A sign-in tab has been opened; please sign in then try again.',
                needsLogin: true,
              });
              return;
            }

            const attemptSave = async (tokenToUse: string): Promise<number> => {
              // Validate token first (lightweight)
              await anki.whoami(tokenToUse);
              return await anki.addNote(message.word, rawJson, tokenToUse);
            };

            const firstToken = hasPrimary ? primaryToken : fallbackToken;
            const secondToken = hasPrimary && hasFallback ? fallbackToken : '';

            try {
              const noteId = await attemptSave(firstToken);
              sendResponse({ success: true, noteId });
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : String(error);
              if (isAuthErrorMessage(msg) && secondToken) {
                try {
                  const noteId = await attemptSave(secondToken);
                  // Promote the working token so future saves don't need a retry.
                  chrome.storage.local.set({ ankiAuthToken: secondToken });
                  chrome.storage.local.remove(['ankiAuthTokenFallback']);
                  sendResponse({ success: true, noteId });
                  return;
                } catch (error2: unknown) {
                  const msg2 = error2 instanceof Error ? error2.message : String(error2);
                  if (isAuthErrorMessage(msg2)) {
                    chrome.storage.local.remove(['ankiAuthToken', 'ankiAuthTokenFallback']);
                    openLoginTab();
                    sendResponse({
                      error:
                        'Your Anki service login expired. A sign-in tab has been opened; please sign in then try again.',
                      needsLogin: true,
                    });
                    return;
                  }

                  sendResponse({ error: msg2 });
                  return;
                }
              }

              if (isAuthErrorMessage(msg)) {
                chrome.storage.local.remove(['ankiAuthToken', 'ankiAuthTokenFallback']);
                openLoginTab();
                sendResponse({
                  error:
                    'Your Anki service login expired. A sign-in tab has been opened; please sign in then try again.',
                  needsLogin: true,
                });
                return;
              }

              sendResponse({ error: msg });
            }
          }
        );
      }
    );

    return true;
  } else if (message.type === 'SPEAK_TEXT') {
    chrome.tts.getVoices((voices) => {
      // Find a natural-sounding Google voice if possible, otherwise any English voice
      const preferredVoice =
        voices.find(
          (v) => v.voiceName && v.voiceName.includes('Google') && v.lang && v.lang.startsWith('en')
        ) || voices.find((v) => v.lang && v.lang.startsWith('en'));

      const options: chrome.tts.TtsOptions = {
        voiceName: preferredVoice?.voiceName,
        lang: 'en-US',
        rate: 1.0,
        onEvent: (event: chrome.tts.TtsEvent) => {
          if (sender.tab?.id) {
            chrome.tabs
              .sendMessage(sender.tab.id, {
                type: 'TTS_EVENT',
                status: event.type,
              })
              .catch(() => {
                // Ignore errors if tab is closed/unreachable
              });
          }
        },
      };

      chrome.tts.speak(message.text, options);
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'EXPORT_TO_ANKI_CONNECT') {
    const note = message.note;
    // Format for AnkiConnect
    const payload = {
      action: 'addNote',
      version: 6,
      params: {
        note: {
          deckName: note.deckName || 'Default',
          modelName: note.modelName || 'Basic',
          fields: note.fields,
          tags: note.tags || []
        }
      }
    };

    fetch('http://127.0.0.1:8765', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const data = await res.json();
        if (data.error) {
          sendResponse({ success: false, error: data.error });
        } else {
          sendResponse({ success: true, result: data.result });
        }
      })
      .catch((err) => {
        sendResponse({ success: false, error: 'Could not connect to Anki. Is it running with AnkiConnect?' });
      });
    return true;
  }
});
