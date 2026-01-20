import { getState, translateWord, translateWithSentence } from './lib/storage';

// Toggle to simulate errors for testing (set to false for production)
const SIMULATE_ERRORS = {
  translateApi: false  // Error #4: DeepL API failure
};

export {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'swaparoo-add',
    title: 'Add "%s" to Swaparoo',
    contexts: ['selection']
  });
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
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, message);
    }
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
        if (SIMULATE_ERRORS.translateApi) {
          throw new Error('Simulated API failure');
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
