import { Storage } from '@plasmohq/storage';

export interface WordPair {
  en: string;
  es: string;
  addedAt: number;
  pos?: string;
  sentenceEn?: string;
  sentenceEs?: string;
}

export type SortOption = 'en-asc' | 'en-desc' | 'es-asc' | 'es-desc' | 'added-asc' | 'added-desc';

export interface UserState {
  enabled: boolean;
  words: WordPair[];
  learnedWords: WordPair[];
  blockedDomains: string[];
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
  words: DEFAULT_WORDS,
  learnedWords: [],
  blockedDomains: []
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

export async function addWord(
  en: string,
  es: string,
  pos?: string,
  sentenceEn?: string,
  sentenceEs?: string
): Promise<void> {
  const state = await getState();
  const exists = state.words.some(w => w.en.toLowerCase() === en.toLowerCase());
  if (!exists) {
    await setState({
      words: [...state.words, { en, es, addedAt: Date.now(), pos, sentenceEn, sentenceEs }]
    });
  }
}

export async function removeWord(en: string): Promise<void> {
  const state = await getState();
  await setState({
    words: state.words.filter(w => w.en.toLowerCase() !== en.toLowerCase())
  });
}

export async function removeLearnedWord(en: string): Promise<void> {
  const state = await getState();
  await setState({
    learnedWords: (state.learnedWords || []).filter(w => w.en.toLowerCase() !== en.toLowerCase())
  });
}

export async function markAsLearned(en: string): Promise<void> {
  const state = await getState();
  const word = state.words.find(w => w.en.toLowerCase() === en.toLowerCase());
  if (word) {
    await setState({
      words: state.words.filter(w => w.en.toLowerCase() !== en.toLowerCase()),
      learnedWords: [...(state.learnedWords || []), word]
    });
  }
}

export async function moveToLearning(en: string): Promise<void> {
  const state = await getState();
  const word = (state.learnedWords || []).find(w => w.en.toLowerCase() === en.toLowerCase());
  if (word) {
    await setState({
      learnedWords: (state.learnedWords || []).filter(w => w.en.toLowerCase() !== en.toLowerCase()),
      words: [...state.words, word]
    });
  }
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
  direction: 'en-to-es' | 'es-to-en' = 'en-to-es',
  context?: string
): Promise<string | null> {
  try {
    const body: Record<string, unknown> = {
      text: [word],
      source_lang: direction === 'en-to-es' ? 'EN' : 'ES',
      target_lang: direction === 'en-to-es' ? 'ES' : 'EN'
    };

    if (context) {
      body.context = context;
    }

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.translations?.[0]?.text?.toLowerCase() || null;
  } catch {
    return null;
  }
}

export interface TranslationResult {
  word: string | null;
  sentence: string | null;
}

export async function translateWithSentence(
  word: string,
  sentence: string,
  apiKey: string,
  direction: 'en-to-es' | 'es-to-en' = 'en-to-es'
): Promise<TranslationResult> {
  try {
    const body: Record<string, unknown> = {
      text: [word, sentence],
      context: sentence,
      source_lang: direction === 'en-to-es' ? 'EN' : 'ES',
      target_lang: direction === 'en-to-es' ? 'ES' : 'EN'
    };

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) return { word: null, sentence: null };

    const data = await response.json();
    const translations = data.translations || [];
    return {
      word: translations[0]?.text?.toLowerCase() || null,
      sentence: translations[1]?.text || null
    };
  } catch {
    return { word: null, sentence: null };
  }
}

export async function addBlockedDomain(domain: string): Promise<void> {
  const state = await getState();
  const normalized = domain.toLowerCase().trim();
  if (normalized && !(state.blockedDomains || []).includes(normalized)) {
    await setState({
      blockedDomains: [...(state.blockedDomains || []), normalized]
    });
  }
}

export async function removeBlockedDomain(domain: string): Promise<void> {
  const state = await getState();
  await setState({
    blockedDomains: (state.blockedDomains || []).filter(d => d !== domain)
  });
}

export function isDomainBlocked(hostname: string, blockedDomains: string[]): boolean {
  const normalized = hostname.toLowerCase();
  return (blockedDomains || []).some(blocked => {
    return normalized === blocked || normalized.endsWith('.' + blocked);
  });
}

export { storage };
