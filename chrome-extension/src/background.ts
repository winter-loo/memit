import { MemCoolExplainer } from './lib/explanation/providers/memcool';
import { OpenRouterExplainer } from './lib/explanation/providers/openrouter';
import { GeminiExplainer } from './lib/explanation/providers/gemini';
import { AnkiClient } from './lib/anki/client';
import { formatExplanationToHtml } from './lib/anki/formatter';
import { countWords } from './lib/text-utils';

const memcool = new MemCoolExplainer();
const openrouter = new OpenRouterExplainer();
const gemini = new GeminiExplainer();
const anki = new AnkiClient();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'mem-it',
    title: 'Mem it',
    contexts: ['selection'],
  });

  // Initialize default settings
  chrome.storage.sync.get(['theme', 'modelId'], (result) => {
    if (!result.theme) {
      chrome.storage.sync.set({ theme: 'light' });
    }
    if (!result.modelId) {
      chrome.storage.sync.set({ modelId: 'memcool:gemini-2.5-flash-lite' });
    }
    if (!result.ankiBackendUrl) {
      chrome.storage.sync.set({ ankiBackendUrl: 'https://memit.ldd.cool' });
    }
  });
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
        const ankiBackendUrl = settings.ankiBackendUrl || 'https://memit.ldd.cool';

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
    // Received from auth-bridge content script on https://mem.ldd.cool/*
    const token = message.token;
    if (typeof token === 'string' && token.length > 0) {
      chrome.storage.local.set({ ankiAuthToken: token });

      // If this tab was opened for login, close it.
      if (sender.tab?.id) {
        chrome.tabs.remove(sender.tab.id).catch(() => {
          // ignore
        });
      }

      sendResponse({ success: true });
    } else {
      sendResponse({ error: 'Missing token' });
    }
    return true;
  } else if (message.type === 'SAVE_TO_ANKI') {
    const html = formatExplanationToHtml(message.explanation);

    chrome.storage.sync.get(['ankiBackendUrl'], (syncResult: { ankiBackendUrl?: string }) => {
      const ankiBackendUrl = syncResult.ankiBackendUrl || 'https://memit.ldd.cool';
      anki.setBaseUrl(ankiBackendUrl);

      const openLoginTab = () => {
        chrome.tabs.create({ url: ankiBackendUrl });
      };

      chrome.storage.local.get(['ankiAuthToken'], async (result: { ankiAuthToken?: string }) => {
        const token = result.ankiAuthToken;
        if (!token) {
          openLoginTab();
          sendResponse({
            error:
              'Not signed in to Anki service. A sign-in tab has been opened; please sign in then try again.',
            needsLogin: true,
          });
          return;
        }

        try {
          // Validate token first (lightweight)
          await anki.whoami(token);
          const noteId = await anki.addNote(message.word, html, token);
          sendResponse({ success: true, noteId });
        } catch (error: any) {
          // If auth failed, prompt login and let user retry.
          const msg = error?.message || String(error);
          if (
            msg.includes('Auth Error: 401') ||
            msg.includes('Auth Error: 403') ||
            msg.includes('Missing Bearer token')
          ) {
            chrome.storage.local.remove(['ankiAuthToken']);
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
      });
    });

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
  }
});
