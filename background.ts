export {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'swaparoo-add',
    title: 'Add "%s" to Swaparoo',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'swaparoo-add' && info.selectionText && tab?.id) {
    const word = info.selectionText.trim();
    if (word && !word.includes(' ')) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SWAPAROO_ADD_WORD',
        word: word
      });
    }
  }
});
