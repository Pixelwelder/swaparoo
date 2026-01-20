# Error Handling Checklist

## CSUI Modal (`contents/add-word-modal.tsx`)

- [x] 1. `getState()` - Storage read failure when loading API key
- [ ] 2. `addWord()` - Storage write failure when saving word
- [ ] 3. `handleTranslate()` - Message to background not handled/no response

## Background Script (`background.ts`)

- [ ] 4. `translateWithSentence()` - DeepL API failure (network, auth, rate limit)
- [ ] 5. Message relay - No sender.tab (modal never opens)

## AddWordModal Component (`components/AddWordModal.tsx`)

- [ ] 6. `runTranslation()` - Translation error (already has try/catch but no UI feedback)

## Auto-translate Bug (separate from error handling)

- [ ] 7. useEffect checks `apiKey` but should also check `onTranslate`
