# Swaparoo Architecture

## Overview

Browser extension that swaps English words with Spanish equivalents. User marks words as learned to shrink their pool over time.

## File Structure

```
swaparoo/
├── data/
│   └── words.json          # Static word list (ships with extension)
├── lib/
│   └── storage.ts          # chrome.storage wrapper
├── contents/
│   └── swap.ts             # Content script (DOM manipulation)
├── popup.tsx               # Plasmo popup entry (React control panel)
└── package.json
```

Note: Plasmo treats `src/` as a special directory, so we use `lib/` for shared code.

## Data Model

### words.json (static, ~5000 entries)

```json
[
  { "en": "conversation", "es": "conversación" },
  { "en": "important", "es": "importante" },
  { "en": "necessary", "es": "necesario" }
]
```

### chrome.storage.sync (user state)

```typescript
interface UserState {
  enabled: boolean;
  swapPercent: number;        // 5-50%
  learned: string[];          // English words marked learned
  wrong: string[];            // Words with bad translations
}

// Default
{
  enabled: true,
  swapPercent: 15,
  learned: [],
  wrong: []
}
```

## Components

### 1. Content Script (`content.ts`)

Runs on every page. Walks the DOM, finds text nodes, swaps words.

```typescript
// Pseudocode
1. Load words.json
2. Load user state (learned, wrong, swapPercent)
3. Build active pool = words - learned - wrong
4. Walk DOM text nodes
5. For each word, X% chance to swap if in pool
6. Wrap swapped words in <span class="swaparoo"> for styling/interaction
```

### 2. Popup (`popup.tsx`)

React UI for settings and stats.

```
┌─────────────────────────┐
│ Swaparoo          [on]  │
├─────────────────────────┤
│ Swap rate:  [====] 15%  │
├─────────────────────────┤
│ Pool: 4,823 words       │
│ Learned: 177            │
│ Wrong: 12               │
├─────────────────────────┤
│ [Reset Progress]        │
└─────────────────────────┘
```

### 3. Storage (`storage.ts`)

Simple wrapper around chrome.storage.sync.

```typescript
export async function getState(): Promise<UserState>
export async function setState(partial: Partial<UserState>): Promise<void>
export async function markLearned(word: string): Promise<void>
export async function markWrong(word: string): Promise<void>
```

## Interaction Flow

### Marking a word as learned

1. User hovers/clicks swapped word
2. Tooltip appears: "conversación" → conversation [✓ Got it] [✗ Wrong]
3. Click "Got it" → word added to `learned[]`
4. Word no longer swaps on future pages

### Marking a word as wrong

1. User clicks "Wrong"
2. Word added to `wrong[]`
3. Never swaps again (bad translation)

## Styling

Swapped words get a subtle underline or background:

```css
.swaparoo {
  border-bottom: 1px dotted #6366f1;
  cursor: help;
}
```

## Constraints

- No network requests (offline-first)
- No user accounts
- Single static word list (can update via extension updates)
- ~100KB storage limit (plenty for flags on 5000 words)
