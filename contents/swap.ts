import type { PlasmoCSConfig } from 'plasmo';
import { getState, removeWord, addWord } from '../lib/storage';

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle'
};

let activePool: Map<string, string>;
let enabled: boolean;

async function init() {
  const state = await getState();
  enabled = state.enabled;

  if (!enabled) return;

  activePool = new Map();
  state.words.forEach(({ en, es }) => {
    activePool.set(en.toLowerCase(), es);
  });

  processDocument();
  injectStyles();
}

function processDocument() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'textarea', 'input', 'code', 'pre'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('.swaparoo')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  textNodes.forEach(processTextNode);
}

function processTextNode(textNode: Text) {
  const text = textNode.textContent;
  if (!text || !text.trim()) return;

  const wordRegex = /\b([a-zA-Z]+)\b/g;
  const fragments: (string | HTMLSpanElement)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasSwaps = false;

  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[1];
    const lowerWord = word.toLowerCase();
    const spanish = activePool.get(lowerWord);

    if (spanish) {
      if (match.index > lastIndex) {
        fragments.push(text.slice(lastIndex, match.index));
      }

      const span = createSwapSpan(word, spanish);
      fragments.push(span);
      hasSwaps = true;
      lastIndex = match.index + word.length;
    }
  }

  if (!hasSwaps) return;

  if (lastIndex < text.length) {
    fragments.push(text.slice(lastIndex));
  }

  const parent = textNode.parentNode;
  if (!parent) return;

  const wrapper = document.createDocumentFragment();
  fragments.forEach(frag => {
    if (typeof frag === 'string') {
      wrapper.appendChild(document.createTextNode(frag));
    } else {
      wrapper.appendChild(frag);
    }
  });

  parent.replaceChild(wrapper, textNode);
}

function createSwapSpan(english: string, spanish: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'swaparoo';
  span.textContent = spanish;
  span.dataset.en = english;
  span.dataset.es = spanish;

  span.addEventListener('mouseenter', showTooltip);
  span.addEventListener('mouseleave', scheduleHideTooltip);

  return span;
}

let tooltip: HTMLDivElement | null = null;
let hideTimeout: number | null = null;

function cancelHideTooltip() {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function scheduleHideTooltip() {
  cancelHideTooltip();
  hideTimeout = window.setTimeout(() => {
    hideTooltip();
  }, 150);
}

function showTooltip(e: MouseEvent) {
  const span = e.target as HTMLSpanElement;
  const en = span.dataset.en || '';
  const es = span.dataset.es || '';

  cancelHideTooltip();

  if (tooltip) {
    tooltip.remove();
  }

  tooltip = document.createElement('div');
  tooltip.className = 'swaparoo-tooltip';
  tooltip.innerHTML = `
    <div class="swaparoo-tooltip-word">${es} → ${en}</div>
    <div class="swaparoo-tooltip-actions">
      <button class="swaparoo-btn swaparoo-btn-remove">✗ Remove</button>
    </div>
  `;

  tooltip.addEventListener('mouseenter', cancelHideTooltip);
  tooltip.addEventListener('mouseleave', scheduleHideTooltip);

  const removeBtn = tooltip.querySelector('.swaparoo-btn-remove');

  removeBtn?.addEventListener('click', async () => {
    await removeWord(en.toLowerCase());
    removeAllInstances(en.toLowerCase());
    hideTooltip();
  });

  document.body.appendChild(tooltip);

  const rect = span.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 4}px`;
}

function hideTooltip() {
  cancelHideTooltip();
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

function removeAllInstances(englishWord: string) {
  document.querySelectorAll('.swaparoo').forEach(span => {
    if ((span as HTMLSpanElement).dataset.en?.toLowerCase() === englishWord) {
      const text = document.createTextNode((span as HTMLSpanElement).dataset.en || '');
      span.parentNode?.replaceChild(text, span);
    }
  });
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .swaparoo {
      background-color: rgba(99, 102, 241, 0.08);
      border-radius: 2px;
      padding: 0 2px;
      margin: 0 -2px;
      cursor: help;
      color: inherit;
    }

    .swaparoo:hover {
      background-color: rgba(99, 102, 241, 0.18);
    }

    .swaparoo-tooltip {
      position: absolute;
      z-index: 999999;
      background: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .swaparoo-tooltip-word {
      margin-bottom: 8px;
      font-weight: 500;
    }

    .swaparoo-tooltip-actions {
      display: flex;
      gap: 8px;
    }

    .swaparoo-btn {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .swaparoo-btn-remove {
      background: #ef4444;
      color: white;
    }

    .swaparoo-btn-remove:hover {
      background: #dc2626;
    }

    .swaparoo-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .swaparoo-modal {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      min-width: 280px;
    }

    .swaparoo-modal h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #1f2937;
      text-align: center;
      font-weight: 600;
    }

    .swaparoo-modal-inputs {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .swaparoo-modal-inputs input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
      min-width: 0;
      color: #1f2937;
      background: white;
    }

    .swaparoo-modal-inputs input::placeholder {
      color: #9ca3af;
    }

    .swaparoo-modal-inputs input:focus {
      outline: none;
      border-color: #6366f1;
    }

    .swaparoo-swap-btn {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: white;
      color: #6366f1;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .swaparoo-swap-btn:hover {
      background: #f5f3ff;
      border-color: #6366f1;
    }

    .swaparoo-modal-buttons {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .swaparoo-modal-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }

    .swaparoo-modal-btn-cancel {
      background: #f3f4f6;
      color: #374151;
    }

    .swaparoo-modal-btn-cancel:hover {
      background: #e5e7eb;
    }

    .swaparoo-modal-btn-add {
      background: #6366f1;
      color: white;
    }

    .swaparoo-modal-btn-add:hover {
      background: #4f46e5;
    }

    .swaparoo-modal-btn-add:disabled {
      background: #a5b4fc;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

// Listen for messages from background and popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SWAPAROO_ADD_WORD') {
    showAddWordModal(message.word);
  } else if (message.type === 'SWAPAROO_ADD_WORD_DIRECT') {
    if (!activePool) {
      activePool = new Map();
      injectStyles();
    }
    activePool.set(message.word, message.translation);
    processDocument();
  } else if (message.type === 'SWAPAROO_REMOVE_WORD') {
    activePool?.delete(message.word);
    removeAllInstances(message.word);
  }
});

function showAddWordModal(selectedWord: string) {
  let originalSlot: 'en' | 'es' = 'es';
  const originalWord = selectedWord.toLowerCase();

  const overlay = document.createElement('div');
  overlay.className = 'swaparoo-modal-overlay';
  overlay.innerHTML = `
    <div class="swaparoo-modal">
      <h3>Add to Swaparoo</h3>
      <div class="swaparoo-modal-inputs">
        <input type="text" class="swaparoo-input-en" placeholder="English" />
        <button class="swaparoo-swap-btn" title="Swap">↔</button>
        <input type="text" class="swaparoo-input-es" placeholder="Spanish" />
      </div>
      <div class="swaparoo-modal-buttons">
        <button class="swaparoo-modal-btn swaparoo-modal-btn-cancel">Cancel</button>
        <button class="swaparoo-modal-btn swaparoo-modal-btn-add" disabled>Add</button>
      </div>
    </div>
  `;

  const enInput = overlay.querySelector('.swaparoo-input-en') as HTMLInputElement;
  const esInput = overlay.querySelector('.swaparoo-input-es') as HTMLInputElement;
  const swapBtn = overlay.querySelector('.swaparoo-swap-btn') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('.swaparoo-modal-btn-cancel');
  const addBtn = overlay.querySelector('.swaparoo-modal-btn-add') as HTMLButtonElement;

  function updateAddButton() {
    addBtn.disabled = !enInput.value.trim() || !esInput.value.trim();
  }

  function close() {
    overlay.remove();
  }

  async function runTranslation() {
    if (originalSlot === 'es') {
      esInput.value = originalWord;
      enInput.value = '';
      enInput.placeholder = 'Translating...';

      const response = await chrome.runtime.sendMessage({
        type: 'SWAPAROO_TRANSLATE',
        word: originalWord,
        direction: 'es-to-en'
      });
      enInput.value = response?.translation || '';
      enInput.placeholder = 'English';
    } else {
      enInput.value = originalWord;
      esInput.value = '';
      esInput.placeholder = 'Translating...';

      const response = await chrome.runtime.sendMessage({
        type: 'SWAPAROO_TRANSLATE',
        word: originalWord,
        direction: 'en-to-es'
      });
      esInput.value = response?.translation || '';
      esInput.placeholder = 'Spanish';
    }

    updateAddButton();
  }

  function handleSwap() {
    originalSlot = originalSlot === 'es' ? 'en' : 'es';
    runTranslation();
  }

  async function add() {
    const en = enInput.value.trim().toLowerCase();
    const es = esInput.value.trim().toLowerCase();

    if (en && es) {
      await addWord(en, es);
      if (!activePool) {
        activePool = new Map();
        injectStyles();
      }
      activePool.set(en, es);
      processDocument();
      close();
    }
  }

  swapBtn.addEventListener('click', handleSwap);
  enInput.addEventListener('input', updateAddButton);
  esInput.addEventListener('input', updateAddButton);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  cancelBtn?.addEventListener('click', close);
  addBtn?.addEventListener('click', add);

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !addBtn.disabled) add();
    if (e.key === 'Escape') close();
  });

  document.body.appendChild(overlay);
  runTranslation();
}

init();
