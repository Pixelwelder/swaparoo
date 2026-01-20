import { getState, translateWord, translateWithSentence } from './lib/storage';

export {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'swaparoo-add',
    title: 'Add "%s" to Swaparoo',
    contexts: ['selection']
  });
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'add-selected-word') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    try {
      // Get selected text from the page
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString().trim() || ''
      });

      const selectedText = results?.[0]?.result;
      if (selectedText && !selectedText.includes(' ')) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SWAPAROO_ADD_WORD',
          word: selectedText
        });
      }
    } catch {
      // Content script not loaded or scripting failed
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'swaparoo-add' && info.selectionText && tab?.id) {
    const word = info.selectionText.trim();
    if (word && !word.includes(' ')) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SWAPAROO_ADD_WORD',
          word: word
        });
      } catch {
        // Content script not loaded - page needs refresh
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SWAPAROO_SHOW_ADD_MODAL') {
    // Relay to CSUI modal in the same tab
    (async () => {
      let tabId = sender.tab?.id;
      if (!tabId) {
        // Fallback: try to find the active tab
        console.warn('SWAPAROO_SHOW_ADD_MODAL: No sender.tab, falling back to active tab');
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = activeTab?.id;
      }
      if (tabId) {
        chrome.tabs.sendMessage(tabId, message);
      } else {
        console.error('SWAPAROO_SHOW_ADD_MODAL: Could not find tab to send modal message');
      }
    })();
    return;
  }

  if (message.type === 'SWAPAROO_TRANSLATE') {
    (async () => {
      const state = await getState();
      if (!state.deeplApiKey) {
        sendResponse({ translation: null });
        return;
      }
      const translation = await translateWord(
        message.word,
        state.deeplApiKey,
        message.direction,
        message.context
      );
      sendResponse({ translation });
    })();
    return true;
  }

  if (message.type === 'SWAPAROO_TRANSLATE_WITH_SENTENCE') {
    (async () => {
      try {
        const state = await getState();
        if (!state.deeplApiKey) {
          sendResponse({ word: null, sentence: null, error: 'No API key configured. Add your DeepL API key in settings.' });
          return;
        }
        const result = await translateWithSentence(
          message.word,
          message.sentence,
          state.deeplApiKey,
          message.direction
        );
        sendResponse(result);
      } catch (err) {
        console.error('Translation API error:', err);
        sendResponse({ word: null, sentence: null, error: 'Translation failed. Check your internet connection and API key.' });
      }
    })();
    return true;
  }
});
