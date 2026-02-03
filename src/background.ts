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
      ['modelId', 'openRouterApiKey', 'geminiApiKey'],
      (settings: { modelId?: string; openRouterApiKey?: string; geminiApiKey?: string }) => {
        const modelId = settings.modelId || 'memcool:gemini-2.5-flash-lite';

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
  } else if (message.type === 'SAVE_TO_ANKI') {
    const html = formatExplanationToHtml(message.explanation);
    anki
      .addNote(message.word, html)
      .then((noteId) => sendResponse({ success: true, noteId }))
      .catch((error) => sendResponse({ error: error.message }));
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
