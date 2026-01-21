# Swaparoo Design Document

## Overview

Swaparoo is a Chrome extension for learning Spanish through immersive word replacement. As users browse the web, English words from their vocabulary list are automatically replaced with Spanish translations, creating a passive learning experience.

**Core Concept**: Learn Spanish by seeing Spanish words in context while reading English content.

## Architecture

Swaparoo uses the Plasmo framework and follows the standard Chrome Extension MV3 architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Popup      │    │  Background  │    │  Content Scripts │  │
│  │  (popup.tsx) │◄──►│ (background) │◄──►│  (swap.ts)       │  │
│  │              │    │              │    │  (add-word-modal)│  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│         │                   │                     │             │
│         └───────────────────┴─────────────────────┘             │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │  Chrome Storage │                          │
│                    │     (sync)      │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    DeepL API      │
                    │  (Translation)    │
                    └───────────────────┘
```

### Components

1. **Popup (`popup.tsx`)**: Main UI for managing words, settings, and viewing stats
2. **Background Script (`background.ts`)**: Service worker handling context menus, keyboard shortcuts, and message relay
3. **Content Script - Swap (`contents/swap.ts`)**: Replaces English words with Spanish on web pages
4. **Content Script - Modal (`contents/add-word-modal.tsx`)**: CSUI overlay for adding words from pages
5. **Shared Component (`components/AddWordModal.tsx`)**: Reusable React modal used by both popup and CSUI
6. **Storage Library (`lib/storage.ts`)**: Data persistence and DeepL API integration

## Data Model

### UserState (stored in Chrome sync storage)

```typescript
interface UserState {
  enabled: boolean;           // Master on/off switch
  words: WordPair[];          // Words currently being learned
  learnedWords: WordPair[];   // Words marked as learned (not swapped)
  blockedDomains: string[];   // Domains where swapping is disabled
  deeplApiKey?: string;       // User's DeepL API key
  sortBy?: SortOption;        // Current sort preference for word list
}
```

### WordPair

```typescript
interface WordPair {
  en: string;           // English word (lowercase, used as key)
  es: string;           // Spanish translation
  addedAt: number;      // Unix timestamp when added
  pos?: string;         // Part of speech: 'noun', 'verb', 'adj', 'adv'
  sentenceEn?: string;  // Example sentence in English
  sentenceEs?: string;  // Example sentence in Spanish
}
```

### Storage Details

- **Storage Area**: `sync` (syncs across user's Chrome instances)
- **Storage Key**: `userState`
- **Size Limit**: ~100KB (sync storage limit)
- **Library**: `@plasmohq/storage`

## Message Passing

Messages flow between components via `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`.

### Message Types

| Type | From | To | Purpose |
|------|------|-----|---------|
| `SWAPAROO_ADD_WORD` | Background | swap.ts | Trigger add modal for selected word |
| `SWAPAROO_SHOW_ADD_MODAL` | swap.ts | Background → CSUI | Show the add word modal overlay |
| `SWAPAROO_WORD_ADDED` | CSUI | swap.ts (via postMessage) | Notify that a word was added |
| `SWAPAROO_ADD_WORD_DIRECT` | Popup | swap.ts | Add word directly to active pool |
| `SWAPAROO_REMOVE_WORD` | Popup | swap.ts | Remove word from active pool |
| `SWAPAROO_TOGGLE` | Popup | swap.ts | Enable/disable word swapping |
| `SWAPAROO_TRANSLATE` | Any | Background | Translate single word |
| `SWAPAROO_TRANSLATE_WITH_SENTENCE` | CSUI | Background | Translate word + sentence |

### Message Flow: Adding a Word from Page

```
1. User right-clicks word OR presses Alt+S
2. Background sends SWAPAROO_ADD_WORD to swap.ts
3. swap.ts extracts sentence context, detects POS
4. swap.ts sends SWAPAROO_SHOW_ADD_MODAL to Background
5. Background relays message to CSUI
6. CSUI shows modal, calls Background for translation
7. User clicks Add
8. CSUI saves to storage, posts SWAPAROO_WORD_ADDED
9. swap.ts receives message, updates active pool, reprocesses page
```

## Key Components Detail

### swap.ts - Word Replacement Engine

**Responsibilities**:
- Walk DOM tree finding text nodes
- Replace English words with Spanish from active pool
- Create hover tooltips showing original English
- Handle word removal from page
- Extract sentence context for new words
- Detect part of speech using compromise.js

**Key Functions**:
- `processDocument()`: Walks DOM, finds text nodes, calls `processTextNode`
- `processTextNode()`: Regex matches words, creates swap spans
- `createSwapSpan()`: Creates styled span with hover events
- `showTooltip()`: Displays tooltip with English + remove button
- `extractSentenceContext()`: Gets surrounding sentence for selected word
- `detectPartOfSpeech()`: Uses compromise.js NLP to detect POS

**DOM Structure for Swapped Words**:
```html
<span class="swaparoo" data-en="hello" data-es="hola">hola</span>
```

### AddWordModal.tsx - Shared Add Word UI

**Props**:
```typescript
interface AddWordModalProps {
  apiKey?: string;                    // DeepL API key
  onAdd: (en, es, pos?, sentenceEn?, sentenceEs?) => void;
  onClose: () => void;
  onTranslate?: (word, sentence, direction) => Promise<TranslateResult>;
  initialWord?: string;
  initialSentence?: string;
  initialDirection?: 'en-to-es' | 'es-to-en';
  initialPos?: string;
  readOnlySource?: boolean;           // True when opened from page selection
  error?: string | null;
}
```

**Modes**:
1. **Manual Mode** (`readOnlySource=false`): User types source word, clicks Translate
2. **Page Selection Mode** (`readOnlySource=true`): Source pre-filled, auto-translates

**Translation Logic**:
- If `onTranslate` provided: Uses callback (for CSUI message passing)
- Otherwise: Calls `translateWithSentence` directly (for popup)

### background.ts - Service Worker

**Responsibilities**:
- Create context menu on install
- Handle context menu clicks
- Handle keyboard shortcut (Alt+S)
- Relay messages between content scripts
- Proxy translation API calls

**Why Background Proxies API Calls**:
Content scripts run in page context and may be blocked by CORS. Background script runs in extension context with full network access.

### popup.tsx - Extension Popup

**Features**:
- Toggle enable/disable
- Settings panel (API key, blocked domains)
- Tabbed word lists (Learning / Learned)
- Search/filter words
- Sortable columns (English, Spanish, Date Added)
- Expandable rows showing example sentences
- Add new word button
- Word stats in footer

## Error Handling

### Error Categories

1. **Storage Errors**: Read/write failures to Chrome storage
2. **Translation Errors**: DeepL API failures (network, auth, rate limit)
3. **Message Passing Errors**: Content script not loaded, no sender tab

### Error Display Strategy

| Error Type | Display Location | User Action |
|------------|------------------|-------------|
| Settings load failure | Simplified modal | "Try reloading the page" |
| Word save failure | Modal inline error | Retry or reload |
| Translation failure | Modal inline error | Check API key/connection |
| API key missing | Modal hint | Configure in settings |

### Error Handling Code Patterns

```typescript
// Storage operations
try {
  await addWord(en, es, pos);
} catch (err) {
  setError('Failed to save word. Try again or reload the page.');
}

// Translation with error response
const response = await chrome.runtime.sendMessage({...});
if (response?.error) {
  throw new Error(response.error);
}
```

## Features

### Implemented

- [x] Word swapping on web pages
- [x] Hover tooltips showing English
- [x] Context menu to add words
- [x] Keyboard shortcut (Alt+S)
- [x] Auto-translation via DeepL API
- [x] Part of speech detection (compromise.js)
- [x] Example sentence storage
- [x] Learning/Learned word lists
- [x] Domain blocking
- [x] Search/filter word list
- [x] Sortable word list
- [x] Toast notification on word add
- [x] Word count stats

### Not Implemented

- [ ] Quiz/review mode
- [ ] Import/export word lists
- [ ] Multiple language pairs
- [ ] Spaced repetition
- [ ] Word frequency stats
- [ ] Offline translation cache

## File Structure

```
swaparoo/
├── background.ts              # Service worker
├── popup.tsx                  # Popup UI (React)
├── package.json               # Dependencies + manifest config
├── components/
│   └── AddWordModal.tsx       # Shared modal component
├── contents/
│   ├── swap.ts                # Word replacement content script
│   └── add-word-modal.tsx     # CSUI for in-page modal
├── lib/
│   └── storage.ts             # Storage + API utilities
├── docs/
│   ├── design.md              # This document
│   └── errors.md              # Error handling checklist
└── README.md                  # User-facing documentation
```

## Dependencies

| Package | Purpose |
|---------|---------|
| plasmo | Browser extension framework |
| react, react-dom | UI components |
| @plasmohq/storage | Chrome storage wrapper |
| compromise | NLP for part of speech detection |
| typescript | Type safety |

## Manifest Permissions

```json
{
  "permissions": ["storage", "contextMenus", "tabs", "scripting"],
  "host_permissions": ["https://*/*", "http://*/*"]
}
```

- `storage`: Persist user data
- `contextMenus`: Right-click "Add to Swaparoo"
- `tabs`: Send messages to content scripts
- `scripting`: Execute script for keyboard shortcut

## Known Limitations

1. **Single Word Only**: Multi-word phrases not supported
2. **English-Spanish Only**: Hardcoded language pair
3. **No Conjugation**: Doesn't match verb conjugations
4. **Case Sensitivity**: Matching is case-insensitive but original case not preserved
5. **Bundle Size**: CSUI adds ~632KB due to React bundling
6. **Storage Limit**: Sync storage limited to ~100KB

## Configuration

### DeepL API

- Uses free tier endpoint: `https://api-free.deepl.com/v2/translate`
- Requires user to provide their own API key
- Context parameter used for better translation accuracy

### Keyboard Shortcut

- Default: `Alt+S`
- Configurable via `chrome://extensions/shortcuts`
- Command name: `add-selected-word`

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server with hot reload
npm run build        # Production build
npm run package      # Create distributable zip
```

Build output: `build/chrome-mv3-prod/`

## Testing Considerations

Currently no automated tests. Key areas to test:

1. Word swapping accuracy
2. Tooltip display/hide
3. Modal open/close flows
4. Translation API error handling
5. Storage persistence
6. Message passing between components
7. Domain blocking
8. Search/filter functionality

## Future Architecture Considerations

1. **Reduce Bundle Size**: Consider vanilla JS for CSUI instead of React
2. **Add Local Storage**: Use local storage for sentences to stay under sync limits
3. **Background Translation Cache**: Reduce API calls
4. **Web Workers**: Offload NLP processing
5. **IndexedDB**: For larger vocabulary lists
