import { Storage } from '@plasmohq/storage';

export interface WordPair {
  en: string;
  es: string;
  addedAt: number;
}

export type SortOption = 'en-asc' | 'en-desc' | 'es-asc' | 'es-desc' | 'added-asc' | 'added-desc';

export interface UserState {
  enabled: boolean;
  words: WordPair[];
  deeplApiKey?: string;
  sortBy?: SortOption;
}

const DEFAULT_WORDS: WordPair[] = [
  { en: 'time', es: 'tiempo', addedAt: 0 },
  { en: 'world', es: 'mundo', addedAt: 0 },
  { en: 'life', es: 'vida', addedAt: 0 },
  { en: 'day', es: 'día', addedAt: 0 },
  { en: 'house', es: 'casa', addedAt: 0 },
  { en: 'water', es: 'agua', addedAt: 0 },
  { en: 'money', es: 'dinero', addedAt: 0 },
  { en: 'book', es: 'libro', addedAt: 0 },
  { en: 'friend', es: 'amigo', addedAt: 0 },
  { en: 'family', es: 'familia', addedAt: 0 }
];

const DEFAULT_STATE: UserState = {
  enabled: true,
  words: DEFAULT_WORDS
};

const storage = new Storage({ area: 'sync' });

export async function getState(): Promise<UserState> {
  const state = await storage.get<UserState>('userState');
  return state ?? DEFAULT_STATE;
}

export async function setState(partial: Partial<UserState>): Promise<void> {
  const current = await getState();
  await storage.set('userState', { ...current, ...partial });
}

export async function addWord(en: string, es: string): Promise<void> {
  const state = await getState();
  const exists = state.words.some(w => w.en.toLowerCase() === en.toLowerCase());
  if (!exists) {
    await setState({ words: [...state.words, { en, es, addedAt: Date.now() }] });
  }
}

export async function removeWord(en: string): Promise<void> {
  const state = await getState();
  await setState({
    words: state.words.filter(w => w.en.toLowerCase() !== en.toLowerCase())
  });
}

export async function getApiKey(): Promise<string | undefined> {
  const state = await getState();
  return state.deeplApiKey;
}

export async function setApiKey(key: string): Promise<void> {
  await setState({ deeplApiKey: key });
}

export async function translateWord(
  word: string,
  apiKey: string,
  direction: 'en-to-es' | 'es-to-en' = 'en-to-es'
): Promise<string | null> {
  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [word],
        source_lang: direction === 'en-to-es' ? 'EN' : 'ES',
        target_lang: direction === 'en-to-es' ? 'ES' : 'EN'
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.translations?.[0]?.text?.toLowerCase() || null;
  } catch {
    return null;
  }
}

export { storage };
