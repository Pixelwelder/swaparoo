import { getState, translateWord, translateWithSentence } from './lib/storage';

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
      const state = await getState();
      if (!state.deeplApiKey) {
        sendResponse({ word: null, sentence: null });
        return;
      }
      const result = await translateWithSentence(
        message.word,
        message.sentence,
        state.deeplApiKey,
        message.direction
      );
      sendResponse(result);
    })();
    return true;
  }
});
