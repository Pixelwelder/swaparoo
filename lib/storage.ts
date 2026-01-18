import { Storage } from '@plasmohq/storage';

export interface WordPair {
  en: string;
  es: string;
}

export interface UserState {
  enabled: boolean;
  words: WordPair[];
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

export { storage };
