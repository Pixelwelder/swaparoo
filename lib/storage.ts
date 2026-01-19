import { Storage } from '@plasmohq/storage';

export interface WordPair {
  en: string;
  es: string;
}

export interface UserState {
  enabled: boolean;
  words: WordPair[];
  deeplApiKey?: string;
}

const DEFAULT_WORDS: WordPair[] = [
  { en: 'time', es: 'tiempo' },
  { en: 'world', es: 'mundo' },
  { en: 'life', es: 'vida' },
  { en: 'day', es: 'día' },
  { en: 'house', es: 'casa' },
  { en: 'water', es: 'agua' },
  { en: 'money', es: 'dinero' },
  { en: 'book', es: 'libro' },
  { en: 'friend', es: 'amigo' },
  { en: 'family', es: 'familia' }
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
    await setState({ words: [...state.words, { en, es }] });
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

export async function translateWord(word: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [word],
        source_lang: 'EN',
        target_lang: 'ES'
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
