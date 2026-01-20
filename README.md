# Swaparoo

A Chrome extension for learning Spanish by replacing English words with their Spanish translations as you browse the web.

## Features

- **Word Swapping**: Automatically replaces English words with Spanish translations on any webpage
- **Context Menu**: Right-click any word to add it to your vocabulary
- **Auto-Translation**: Uses DeepL API to translate words and example sentences
- **Part of Speech Detection**: Automatically detects nouns, verbs, adjectives, and adverbs
- **Learning & Learned Lists**: Track words you're learning and mark them as learned
- **Sentence Context**: Store example sentences for each word
- **Domain Blocking**: Disable Swaparoo on specific websites
- **Sortable Word List**: Sort by English, Spanish, or date added
- **Search**: Filter your word list by English or Spanish
- **Keyboard Shortcut**: Press `Alt+S` to quickly add selected words

## Installation

### Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Pixelwelder/swaparoo.git
   cd swaparoo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-dev` folder

### Production Build

```bash
npm run build
```

The production build will be in `build/chrome-mv3-prod`.

## Usage

1. **Setup**: Click the extension icon and add your DeepL API key in settings (free tier available at [deepl.com/pro-api](https://www.deepl.com/pro-api))

2. **Add Words**:
   - Right-click any word on a webpage and select "Add to Swaparoo"
   - Or press `Alt+S` (keyboard shortcut) while a word is selected
   - Or click the extension icon and use the "+ New Word" button

3. **Browse**: Words you've added will be replaced with their Spanish translations on all pages

4. **Review**: Hover over any swapped word to see the original English and optionally remove it

5. **Track Progress**: Use the popup to view your word lists, mark words as learned, and see your stats

## Tech Stack

- [Plasmo](https://www.plasmo.com/) - Browser extension framework
- [React](https://react.dev/) - UI components
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Compromise](https://compromise.cool/) - Natural language processing for POS detection
- [DeepL API](https://www.deepl.com/pro-api) - Translation service

## Project Structure

```
swaparoo/
├── background.ts          # Service worker for context menu and message handling
├── popup.tsx              # Extension popup UI
├── components/
│   └── AddWordModal.tsx   # Shared modal for adding words
├── contents/
│   ├── swap.ts            # Content script for word replacement
│   └── add-word-modal.tsx # CSUI for in-page modal
└── lib/
    └── storage.ts         # Chrome storage and translation utilities
```

## License

MIT
