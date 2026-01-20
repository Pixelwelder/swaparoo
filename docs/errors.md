# Error Handling Checklist

## CSUI Modal (`contents/add-word-modal.tsx`)

- [x] 1. `getState()` - Storage read failure when loading API key
- [x] 2. `addWord()` - Storage write failure when saving word
- [x] 3. `handleTranslate()` - Message to background not handled/no response

## Background Script (`background.ts`)

- [x] 4. `translateWithSentence()` - DeepL API failure (network, auth, rate limit)
- [x] 5. Message relay - No sender.tab (modal never opens) - Added fallback to active tab

## AddWordModal Component (`components/AddWordModal.tsx`)

- [x] 6. `runTranslation()` - Translation error (already has try/catch but no UI feedback) - Fixed in #3

## Auto-translate Bug (separate from error handling)

- [x] 7. useEffect checks `apiKey` but should also check `onTranslate`
