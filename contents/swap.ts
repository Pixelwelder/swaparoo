import type { PlasmoCSConfig } from 'plasmo';
import nlp from 'compromise';
import { getState, removeWord, addWord, isDomainBlocked } from '../lib/storage';

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

  const hostname = window.location.hostname;
  if (isDomainBlocked(hostname, state.blockedDomains || [])) {
    return;
  }

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

    .swaparoo-input-wrapper {
      position: relative;
    }

    .swaparoo-pos-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .swaparoo-pos-label {
      font-size: 12px;
      color: #6b7280;
    }

    .swaparoo-pos-select {
      padding: 4px 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 12px;
      color: #374151;
      background: white;
      cursor: pointer;
      outline: none;
    }

    .swaparoo-pos-select:focus {
      border-color: #6366f1;
    }

    .swaparoo-modal-inputs {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-bottom: 16px;
    }

    .swaparoo-input-group {
      flex: 1;
      min-width: 0;
    }

    .swaparoo-input-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: #6b7280;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .swaparoo-modal-inputs input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
      color: #1f2937;
      background: #f9fafb;
      cursor: default;
    }

    .swaparoo-modal-inputs input:focus {
      outline: none;
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

function detectPartOfSpeech(word: string, sentence: string | null): string | null {
  if (!sentence) return null;

  const doc = nlp(sentence);
  const match = doc.match(word);

  if (!match.found) return null;

  // Get the term data
  const terms = match.json()?.[0]?.terms;
  if (!terms || terms.length === 0) return null;

  const term = terms[0];
  const tags = term.tags || [];

  // Map compromise tags to simple abbreviations
  if (tags.includes('Noun')) return 'n';
  if (tags.includes('Verb')) return 'v';
  if (tags.includes('Adjective')) return 'adj';
  if (tags.includes('Adverb')) return 'adv';
  if (tags.includes('Preposition')) return 'prep';
  if (tags.includes('Conjunction')) return 'conj';
  if (tags.includes('Pronoun')) return 'pron';

  return null;
}

function extractSentenceContext(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;

  // Get the text content of the parent element
  const parentElement = container.nodeType === Node.TEXT_NODE
    ? container.parentElement
    : container as Element;

  if (!parentElement) return null;

  const fullText = parentElement.textContent || '';
  const selectedText = selection.toString().trim();

  // Find the sentence containing the selected word
  // Split by sentence boundaries but keep the delimiters
  const sentences = fullText.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(selectedText.toLowerCase())) {
      return sentence.trim();
    }
  }

  // If no sentence boundary found, return surrounding text (up to 200 chars)
  const selectionStart = fullText.toLowerCase().indexOf(selectedText.toLowerCase());
  if (selectionStart !== -1) {
    const start = Math.max(0, selectionStart - 100);
    const end = Math.min(fullText.length, selectionStart + selectedText.length + 100);
    return fullText.slice(start, end).trim();
  }

  return null;
}

function removeAllSwaps() {
  document.querySelectorAll('.swaparoo').forEach(span => {
    const text = document.createTextNode((span as HTMLSpanElement).dataset.en || '');
    span.parentNode?.replaceChild(text, span);
  });
}

async function reprocessWithState() {
  const state = await getState();
  enabled = state.enabled;

  if (!enabled) {
    removeAllSwaps();
    return;
  }

  const hostname = window.location.hostname;
  if (isDomainBlocked(hostname, state.blockedDomains || [])) {
    removeAllSwaps();
    return;
  }

  activePool = new Map();
  state.words.forEach(({ en, es }) => {
    activePool.set(en.toLowerCase(), es);
  });

  processDocument();
}

// Listen for messages from background and popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SWAPAROO_ADD_WORD') {
    const context = extractSentenceContext();
    const pos = detectPartOfSpeech(message.word, context);
    showAddWordModal(message.word, context, pos);
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
  } else if (message.type === 'SWAPAROO_TOGGLE') {
    if (message.enabled) {
      injectStyles();
      reprocessWithState();
    } else {
      removeAllSwaps();
      enabled = false;
    }
  }
});

function detectPageLanguage(): 'en' | 'es' {
  const lang = document.documentElement.lang?.toLowerCase() || '';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}

function showAddWordModal(selectedWord: string, sentenceContext?: string | null, partOfSpeech?: string | null) {
  let originalSlot: 'en' | 'es' = detectPageLanguage();
  const originalWord = selectedWord.toLowerCase();
  const originalSentence = sentenceContext || null;
  const pos = partOfSpeech || null;

  let sentenceEn: string | null = null;
  let sentenceEs: string | null = null;

  const overlay = document.createElement('div');
  overlay.className = 'swaparoo-modal-overlay';
  overlay.innerHTML = `
    <div class="swaparoo-modal">
      <h3>Add to Swaparoo</h3>
      <div class="swaparoo-modal-inputs">
        <div class="swaparoo-input-group">
          <label class="swaparoo-input-label">English</label>
          <div class="swaparoo-input-wrapper">
            <input type="text" class="swaparoo-input-en" readonly />
          </div>
        </div>
        <button class="swaparoo-swap-btn" title="Swap">↔</button>
        <div class="swaparoo-input-group">
          <label class="swaparoo-input-label">Spanish</label>
          <div class="swaparoo-input-wrapper">
            <input type="text" class="swaparoo-input-es" readonly />
          </div>
        </div>
      </div>
      <div class="swaparoo-pos-row">
        <span class="swaparoo-pos-label">Part of speech:</span>
        <select class="swaparoo-pos-select">
          <option value="">—</option>
          <option value="noun">noun</option>
          <option value="verb">verb</option>
          <option value="adj">adjective</option>
          <option value="adv">adverb</option>
        </select>
      </div>
      <div class="swaparoo-modal-buttons">
        <button class="swaparoo-modal-btn swaparoo-modal-btn-cancel">Cancel</button>
        <button class="swaparoo-modal-btn swaparoo-modal-btn-add" disabled>Add</button>
      </div>
    </div>
  `;

  const enInput = overlay.querySelector('.swaparoo-input-en') as HTMLInputElement;
  const esInput = overlay.querySelector('.swaparoo-input-es') as HTMLInputElement;
  const posSelect = overlay.querySelector('.swaparoo-pos-select') as HTMLSelectElement;
  const swapBtn = overlay.querySelector('.swaparoo-swap-btn') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('.swaparoo-modal-btn-cancel');
  const addBtn = overlay.querySelector('.swaparoo-modal-btn-add') as HTMLButtonElement;

  // Map detected POS abbreviations to select values
  const posMap: Record<string, string> = {
    'n': 'noun',
    'v': 'verb',
    'adj': 'adj',
    'adv': 'adv'
  };
  if (pos && posMap[pos]) {
    posSelect.value = posMap[pos];
  }

  function updateAddButton() {
    addBtn.disabled = !enInput.value.trim() || !esInput.value.trim();
  }

  function close() {
    overlay.remove();
  }

  async function runTranslation() {
    // Reset sentences based on original slot
    if (originalSlot === 'es') {
      sentenceEs = originalSentence;
      sentenceEn = null;
      esInput.value = originalWord;
      enInput.value = '';
      enInput.placeholder = 'Translating...';

      if (originalSentence) {
        const response = await chrome.runtime.sendMessage({
          type: 'SWAPAROO_TRANSLATE_WITH_SENTENCE',
          word: originalWord,
          sentence: originalSentence,
          direction: 'es-to-en'
        });
        enInput.value = response?.word || '';
        sentenceEn = response?.sentence || null;
      } else {
        const response = await chrome.runtime.sendMessage({
          type: 'SWAPAROO_TRANSLATE',
          word: originalWord,
          direction: 'es-to-en'
        });
        enInput.value = response?.translation || '';
      }
      enInput.placeholder = '';
    } else {
      sentenceEn = originalSentence;
      sentenceEs = null;
      enInput.value = originalWord;
      esInput.value = '';
      esInput.placeholder = 'Translating...';

      if (originalSentence) {
        const response = await chrome.runtime.sendMessage({
          type: 'SWAPAROO_TRANSLATE_WITH_SENTENCE',
          word: originalWord,
          sentence: originalSentence,
          direction: 'en-to-es'
        });
        esInput.value = response?.word || '';
        sentenceEs = response?.sentence || null;
      } else {
        const response = await chrome.runtime.sendMessage({
          type: 'SWAPAROO_TRANSLATE',
          word: originalWord,
          direction: 'en-to-es'
        });
        esInput.value = response?.translation || '';
      }
      esInput.placeholder = '';
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
    const selectedPos = posSelect.value || undefined;

    if (en && es) {
      await addWord(en, es, selectedPos, sentenceEn || undefined, sentenceEs || undefined);
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
