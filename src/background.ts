import { MemCoolExplainer } from './lib/explanation/providers/memcool';
import { AnkiClient } from './lib/anki/client';
import { formatExplanationToHtml } from './lib/anki/formatter';
import { countWords } from './lib/text-utils';

const explainer = new MemCoolExplainer();
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
      chrome.storage.sync.set({ modelId: 'gemini-2.5-flash-lite' });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'mem-it' && tab?.id) {
    console.log('Mem it clicked:', info.selectionText);
    
    // Send message to content script to open modal
    chrome.tabs.sendMessage(tab.id, { 
      type: 'OPEN_MODAL', 
      text: info.selectionText 
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

    chrome.storage.sync.get(['modelId'], (settings: { modelId?: string }) => {
      const modelId = settings.modelId || 'gemini-2.5-flash-lite';
      explainer.explain(message.text, { modelId })
        .then(result => sendResponse({ result }))
        .catch(error => sendResponse({ error: error.message }));
    });
    return true;
  } else if (message.type === 'OPEN_SIDE_PANEL') {
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    }
  } else if (message.type === 'SAVE_TO_ANKI') {
    const html = formatExplanationToHtml(message.explanation);
    anki.addNote(message.word, html)
      .then(noteId => sendResponse({ success: true, noteId }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});
