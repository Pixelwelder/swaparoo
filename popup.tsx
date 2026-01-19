import { useEffect, useState, useMemo } from 'react';
import nlp from 'compromise';
import {
  getState,
  setState,
  addWord,
  removeWord,
  removeLearnedWord,
  markAsLearned,
  moveToLearning,
  setApiKey,
  addBlockedDomain,
  removeBlockedDomain,
  translateWithSentence,
  type UserState,
  type SortOption,
  type WordPair
} from './lib/storage';

type Tab = 'learning' | 'learned';

function IndexPopup() {
  const [state, setLocalState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('learning');

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    const s = await getState();
    setLocalState(s);
    setApiKeyInput(s.deeplApiKey || '');
    setLoading(false);
  }

  async function updateEnabled(enabled: boolean) {
    await setState({ enabled });
    setLocalState(prev => prev ? { ...prev, enabled } : null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SWAPAROO_TOGGLE',
        enabled
      });
    }
  }

  async function handleSaveApiKey() {
    await setApiKey(apiKeyInput.trim());
    setLocalState(prev => prev ? { ...prev, deeplApiKey: apiKeyInput.trim() } : null);
  }

  async function handleAddBlockedDomain() {
    if (newBlockedDomain.trim()) {
      await addBlockedDomain(newBlockedDomain.trim());
      setNewBlockedDomain('');
      await loadState();
    }
  }

  async function handleRemoveBlockedDomain(domain: string) {
    await removeBlockedDomain(domain);
    await loadState();
  }

  async function handleAddWord(en: string, es: string, pos?: string, sentenceEn?: string, sentenceEs?: string) {
    await addWord(en, es, pos, sentenceEn, sentenceEs);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SWAPAROO_ADD_WORD_DIRECT',
        word: en,
        translation: es
      });
    }
    await loadState();
    setShowAddModal(false);
  }

  async function handleRemove(en: string, isLearned: boolean) {
    if (isLearned) {
      await removeLearnedWord(en);
    } else {
      await removeWord(en);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SWAPAROO_REMOVE_WORD',
          word: en.toLowerCase()
        });
      }
    }
    await loadState();
  }

  async function handleMarkLearned(en: string) {
    await markAsLearned(en);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SWAPAROO_REMOVE_WORD',
        word: en.toLowerCase()
      });
    }
    await loadState();
  }

  async function handleMoveToLearning(en: string) {
    await moveToLearning(en);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const word = (state?.learnedWords || []).find(w => w.en.toLowerCase() === en.toLowerCase());
      if (word) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SWAPAROO_ADD_WORD_DIRECT',
          word: en.toLowerCase(),
          translation: word.es
        });
      }
    }
    await loadState();
  }

  async function handleSortChange(sortBy: SortOption) {
    await setState({ sortBy });
    setLocalState(prev => prev ? { ...prev, sortBy } : null);
  }

  if (loading || !state) {
    return <div style={styles.popup}>Loading...</div>;
  }

  return (
    <div style={styles.popup}>
      <header style={styles.header}>
        <h1 style={styles.title}>Swaparoo</h1>
        <div style={styles.headerRight}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={styles.settingsBtn}
            title="Settings"
          >
            ⚙
          </button>
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={state.enabled}
              onChange={(e) => updateEnabled(e.target.checked)}
              style={styles.toggleInput}
            />
            <span style={{
              ...styles.toggleSlider,
              backgroundColor: state.enabled ? '#6366f1' : '#cbd5e1'
            }}>
              <span style={{
                ...styles.toggleKnob,
                transform: state.enabled ? 'translateX(20px)' : 'translateX(0)'
              }} />
            </span>
          </label>
        </div>
      </header>

      {showSettings && (
        <div style={styles.settings}>
          <label style={styles.settingsLabel}>DeepL API Key</label>
          <div style={styles.settingsRow}>
            <input
              type="password"
              placeholder="Enter API key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              style={styles.input}
            />
            <button onClick={handleSaveApiKey} style={styles.saveBtn}>Save</button>
          </div>
          <a
            href="https://www.deepl.com/pro-api"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.settingsLink}
          >
            Get free API key →
          </a>

          <div style={styles.settingsDivider} />

          <label style={styles.settingsLabel}>Blocked Domains</label>
          <div style={styles.settingsRow}>
            <input
              type="text"
              placeholder="example.com"
              value={newBlockedDomain}
              onChange={(e) => setNewBlockedDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBlockedDomain()}
              style={styles.input}
            />
            <button onClick={handleAddBlockedDomain} style={styles.saveBtn}>Add</button>
          </div>
          {(state.blockedDomains || []).length > 0 && (
            <div style={styles.blockedList}>
              {(state.blockedDomains || []).map(domain => (
                <div key={domain} style={styles.blockedItem}>
                  <span style={styles.blockedDomain}>{domain}</span>
                  <button
                    onClick={() => handleRemoveBlockedDomain(domain)}
                    style={styles.blockedRemoveBtn}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'learning' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('learning')}
        >
          Learning ({state.words.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'learned' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('learned')}
        >
          Learned ({(state.learnedWords || []).length})
        </button>
      </div>

      {activeTab === 'learning' && (
        <button
          onClick={() => setShowAddModal(true)}
          style={styles.newWordBtn}
        >
          + New Word
        </button>
      )}

      {showAddModal && (
        <AddWordModal
          apiKey={state.deeplApiKey}
          onAdd={handleAddWord}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <WordList
        words={activeTab === 'learning' ? state.words : (state.learnedWords || [])}
        sortBy={state.sortBy}
        onSortChange={handleSortChange}
        onRemove={(en) => handleRemove(en, activeTab === 'learned')}
        onAction={activeTab === 'learning' ? handleMarkLearned : handleMoveToLearning}
        actionIcon={activeTab === 'learning' ? '✓' : '←'}
        actionTitle={activeTab === 'learning' ? 'Mark as learned' : 'Move to learning'}
      />

      <div style={styles.footer}>
        {activeTab === 'learning'
          ? `${state.words.length} word${state.words.length !== 1 ? 's' : ''} learning`
          : `${(state.learnedWords || []).length} word${(state.learnedWords || []).length !== 1 ? 's' : ''} learned`
        }
      </div>
    </div>
  );
}

interface WordListProps {
  words: WordPair[];
  sortBy?: SortOption;
  onSortChange: (sortBy: SortOption) => void;
  onRemove: (en: string) => void;
  onAction: (en: string) => void;
  actionIcon: string;
  actionTitle: string;
}

function WordList({ words, sortBy, onSortChange, onRemove, onAction, actionIcon, actionTitle }: WordListProps) {
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  function toggleExpand(en: string) {
    setExpandedWord(prev => prev === en ? null : en);
  }

  function handleColumnClick(column: 'en' | 'es' | 'added') {
    const currentSort = sortBy || 'added-desc';
    const [currentCol, currentDir] = currentSort.split('-') as [string, string];

    let newSort: SortOption;
    if (currentCol === column) {
      newSort = `${column}-${currentDir === 'asc' ? 'desc' : 'asc'}` as SortOption;
    } else {
      newSort = `${column}-asc` as SortOption;
    }
    onSortChange(newSort);
  }

  function getDaysAgo(timestamp: number): string {
    if (!timestamp) return '—';
    const now = Date.now();
    const days = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
    return `${days}d`;
  }

  function getSortIndicator(column: 'en' | 'es' | 'added'): string {
    const currentSort = sortBy || 'added-desc';
    const [currentCol, currentDir] = currentSort.split('-');
    if (currentCol !== column) return '';
    return currentDir === 'asc' ? ' ▲' : ' ▼';
  }

  const sortedWords = useMemo(() => {
    const wordsCopy = [...words];
    const currentSort = sortBy || 'added-desc';
    const [column, direction] = currentSort.split('-');
    const mult = direction === 'asc' ? 1 : -1;

    switch (column) {
      case 'en':
        return wordsCopy.sort((a, b) => mult * a.en.localeCompare(b.en));
      case 'es':
        return wordsCopy.sort((a, b) => mult * a.es.localeCompare(b.es));
      case 'added':
        return wordsCopy.sort((a, b) => mult * ((a.addedAt || 0) - (b.addedAt || 0)));
      default:
        return wordsCopy;
    }
  }, [words, sortBy]);

  if (words.length === 0) {
    return <div style={styles.empty}>No words yet.</div>;
  }

  return (
    <>
      <div style={styles.tableHeader}>
        <span style={styles.headerCaret}></span>
        <span
          style={styles.headerEn}
          onClick={() => handleColumnClick('en')}
        >
          English{getSortIndicator('en')}
        </span>
        <span style={styles.headerArrow}></span>
        <span
          style={styles.headerEs}
          onClick={() => handleColumnClick('es')}
        >
          Spanish{getSortIndicator('es')}
        </span>
        <span
          style={styles.headerAdded}
          onClick={() => handleColumnClick('added')}
        >
          Added{getSortIndicator('added')}
        </span>
        <span style={styles.headerActions}></span>
      </div>

      <div style={styles.wordList}>
        {sortedWords.map(({ en, es, addedAt, pos, sentenceEn, sentenceEs }) => {
          const isExpanded = expandedWord === en;
          const hasSentences = sentenceEn || sentenceEs;
          return (
            <div key={en} style={styles.wordItem}>
              <div style={styles.wordRow}>
                <button
                  onClick={() => hasSentences && toggleExpand(en)}
                  style={{
                    ...styles.caretBtn,
                    opacity: hasSentences ? 1 : 0.3,
                    cursor: hasSentences ? 'pointer' : 'default'
                  }}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
                <span style={styles.wordEn}>{en}{pos && <span style={styles.wordPos}> {pos === 'noun' ? 'N' : pos === 'verb' ? 'V' : pos === 'adj' ? 'Adj' : pos === 'adv' ? 'Adv' : pos.toUpperCase()}</span>}</span>
                <span style={styles.wordArrow}>→</span>
                <span style={styles.wordEs}>{es}</span>
                <span style={styles.wordAdded}>{getDaysAgo(addedAt)}</span>
                <div style={styles.wordActions}>
                  <button
                    onClick={() => onAction(en)}
                    style={styles.actionBtn}
                    title={actionTitle}
                  >
                    {actionIcon}
                  </button>
                  <button
                    onClick={() => onRemove(en)}
                    style={styles.removeBtn}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div style={styles.expandedContent}>
                  <div style={styles.sentenceRow}>
                    <span style={styles.sentenceEn}>{sentenceEn || '—'}</span>
                    <span style={styles.sentenceEs}>{sentenceEs || '—'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

interface AddWordModalProps {
  apiKey?: string;
  onAdd: (en: string, es: string, pos?: string, sentenceEn?: string, sentenceEs?: string) => void;
  onClose: () => void;
}

function AddWordModal({ apiKey, onAdd, onClose }: AddWordModalProps) {
  const [direction, setDirection] = useState<'en-to-es' | 'es-to-en'>('en-to-es');
  const [sourceWord, setSourceWord] = useState('');
  const [sourceSentence, setSourceSentence] = useState('');
  const [targetWord, setTargetWord] = useState('');
  const [targetSentence, setTargetSentence] = useState('');
  const [pos, setPos] = useState('');
  const [translating, setTranslating] = useState(false);

  function detectPartOfSpeech(word: string): string {
    const doc = nlp(word);
    const terms = doc.terms().json();
    if (terms.length > 0 && terms[0].terms?.length > 0) {
      const tags = terms[0].terms[0].tags || [];
      if (tags.includes('Noun')) return 'noun';
      if (tags.includes('Verb')) return 'verb';
      if (tags.includes('Adjective')) return 'adj';
      if (tags.includes('Adverb')) return 'adv';
    }
    return '';
  }

  async function handleTranslate() {
    if (!apiKey || !sourceWord.trim()) return;

    setTranslating(true);
    const detected = detectPartOfSpeech(sourceWord.trim());
    if (detected) setPos(detected);

    if (sourceSentence.trim()) {
      const result = await translateWithSentence(
        sourceWord.trim(),
        sourceSentence.trim(),
        apiKey,
        direction
      );
      setTargetWord(result.word || '');
      setTargetSentence(result.sentence || '');
    } else {
      const result = await translateWithSentence(
        sourceWord.trim(),
        sourceWord.trim(),
        apiKey,
        direction
      );
      setTargetWord(result.word || '');
    }
    setTranslating(false);
  }

  function handleSwap() {
    setDirection(prev => prev === 'en-to-es' ? 'es-to-en' : 'en-to-es');
    setSourceWord('');
    setSourceSentence('');
    setTargetWord('');
    setTargetSentence('');
    setPos('');
  }

  function handleAdd() {
    const en = direction === 'en-to-es' ? sourceWord.trim().toLowerCase() : targetWord.trim().toLowerCase();
    const es = direction === 'en-to-es' ? targetWord.trim().toLowerCase() : sourceWord.trim().toLowerCase();
    const sentenceEn = direction === 'en-to-es' ? sourceSentence.trim() : targetSentence.trim();
    const sentenceEs = direction === 'en-to-es' ? targetSentence.trim() : sourceSentence.trim();

    if (en && es) {
      onAdd(en, es, pos || undefined, sentenceEn || undefined, sentenceEs || undefined);
    }
  }

  const canAdd = sourceWord.trim() && targetWord.trim();
  const sourceLabel = direction === 'en-to-es' ? 'English' : 'Spanish';
  const targetLabel = direction === 'en-to-es' ? 'Spanish' : 'English';

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={modalStyles.title}>Add New Word</h3>

        <div style={modalStyles.directionRow}>
          <span style={modalStyles.directionLabel}>Translating from:</span>
          <button
            style={{
              ...modalStyles.directionBtn,
              ...(direction === 'en-to-es' ? modalStyles.directionBtnActive : {})
            }}
            onClick={() => direction !== 'en-to-es' && handleSwap()}
          >
            English
          </button>
          <button
            style={{
              ...modalStyles.directionBtn,
              ...(direction === 'es-to-en' ? modalStyles.directionBtnActive : {})
            }}
            onClick={() => direction !== 'es-to-en' && handleSwap()}
          >
            Spanish
          </button>
        </div>

        <div style={modalStyles.columns}>
          <div style={modalStyles.column}>
            <label style={modalStyles.label}>{sourceLabel} (editable)</label>
            <input
              type="text"
              placeholder="Word"
              value={sourceWord}
              onChange={e => setSourceWord(e.target.value)}
              style={modalStyles.input}
            />
            <textarea
              placeholder="Sentence (optional)"
              value={sourceSentence}
              onChange={e => setSourceSentence(e.target.value)}
              style={modalStyles.textarea}
              rows={2}
            />
          </div>

          <div style={modalStyles.arrow}>→</div>

          <div style={modalStyles.column}>
            <label style={modalStyles.label}>{targetLabel} (translated)</label>
            <input
              type="text"
              placeholder={translating ? 'Translating...' : 'Word'}
              value={targetWord}
              readOnly
              style={{ ...modalStyles.input, ...modalStyles.inputReadOnly }}
            />
            <textarea
              placeholder={translating ? 'Translating...' : 'Sentence'}
              value={targetSentence}
              readOnly
              style={{ ...modalStyles.textarea, ...modalStyles.inputReadOnly }}
              rows={2}
            />
          </div>
        </div>

        <div style={modalStyles.posRow}>
          <span style={modalStyles.posLabel}>Part of speech:</span>
          <select
            value={pos}
            onChange={e => setPos(e.target.value)}
            style={modalStyles.posSelect}
          >
            <option value="">—</option>
            <option value="noun">noun</option>
            <option value="verb">verb</option>
            <option value="adj">adjective</option>
            <option value="adv">adverb</option>
          </select>
        </div>

        <div style={modalStyles.buttons}>
          <button onClick={onClose} style={modalStyles.cancelBtn}>Cancel</button>
          <button
            onClick={handleTranslate}
            disabled={!apiKey || !sourceWord.trim() || translating}
            style={modalStyles.translateBtn}
          >
            {translating ? 'Translating...' : 'Translate'}
          </button>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            style={{
              ...modalStyles.addBtn,
              ...(canAdd ? {} : modalStyles.addBtnDisabled)
            }}
          >
            Add
          </button>
        </div>

        {!apiKey && (
          <div style={modalStyles.hint}>
            Add a DeepL API key in settings for auto-translation
          </div>
        )}
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'white',
    borderRadius: 8,
    padding: 20,
    width: 380,
    maxHeight: '90vh',
    overflow: 'auto'
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2937',
    textAlign: 'center'
  },
  directionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  directionLabel: {
    fontSize: 12,
    color: '#6b7280'
  },
  directionBtn: {
    padding: '4px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    background: 'white',
    fontSize: 12,
    cursor: 'pointer',
    color: '#6b7280'
  },
  directionBtnActive: {
    background: '#6366f1',
    borderColor: '#6366f1',
    color: 'white'
  },
  columns: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 16
  },
  column: {
    flex: 1
  },
  arrow: {
    paddingTop: 28,
    color: '#9ca3af',
    fontSize: 16
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 8,
    boxSizing: 'border-box' as const,
    outline: 'none'
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 12,
    resize: 'none' as const,
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    outline: 'none'
  },
  inputReadOnly: {
    background: '#f9fafb',
    color: '#6b7280'
  },
  posRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  posLabel: {
    fontSize: 12,
    color: '#6b7280'
  },
  posSelect: {
    padding: '4px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: 12,
    color: '#374151',
    background: 'white',
    cursor: 'pointer',
    outline: 'none'
  },
  buttons: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end'
  },
  cancelBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 6,
    background: '#f3f4f6',
    color: '#374151',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  },
  translateBtn: {
    padding: '8px 16px',
    border: '1px solid #6366f1',
    borderRadius: 6,
    background: 'white',
    color: '#6366f1',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  },
  addBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 6,
    background: '#6366f1',
    color: 'white',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  },
  addBtnDisabled: {
    background: '#a5b4fc',
    cursor: 'not-allowed'
  },
  hint: {
    marginTop: 12,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center'
  }
};

const styles: Record<string, React.CSSProperties> = {
  popup: {
    width: 400,
    padding: 16,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: '#fff'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: '1px solid #e5e7eb'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1f2937',
    margin: 0
  },
  settingsBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
    color: '#6b7280'
  },
  toggle: {
    position: 'relative',
    display: 'inline-block',
    width: 44,
    height: 24,
    cursor: 'pointer'
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0
  },
  toggleSlider: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    transition: '0.2s'
  },
  toggleKnob: {
    position: 'absolute',
    content: '',
    height: 18,
    width: 18,
    left: 3,
    bottom: 3,
    backgroundColor: 'white',
    borderRadius: '50%',
    transition: '0.2s'
  },
  settings: {
    marginBottom: 12,
    padding: 12,
    background: '#f9fafb',
    borderRadius: 6
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: '#4b5563',
    marginBottom: 6,
    display: 'block'
  },
  settingsRow: {
    display: 'flex',
    gap: 8
  },
  settingsLink: {
    fontSize: 11,
    color: '#6366f1',
    textDecoration: 'none',
    marginTop: 8,
    display: 'block'
  },
  settingsDivider: {
    height: 1,
    background: '#e5e7eb',
    margin: '12px 0'
  },
  blockedList: {
    marginTop: 8,
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6
  },
  blockedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    background: '#fee2e2',
    borderRadius: 4,
    fontSize: 12
  },
  blockedDomain: {
    color: '#991b1b'
  },
  blockedRemoveBtn: {
    background: 'transparent',
    border: 'none',
    color: '#991b1b',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1
  },
  saveBtn: {
    flexShrink: 0,
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    background: '#6366f1',
    color: 'white',
    fontSize: 12,
    cursor: 'pointer'
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 12
  },
  tab: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: 'white',
    fontSize: 13,
    color: '#6b7280',
    cursor: 'pointer'
  },
  tabActive: {
    background: '#6366f1',
    borderColor: '#6366f1',
    color: 'white',
    fontWeight: 500
  },
  newWordBtn: {
    width: '100%',
    padding: '10px 16px',
    border: '1px dashed #d1d5db',
    borderRadius: 6,
    background: 'white',
    color: '#6b7280',
    fontSize: 13,
    cursor: 'pointer',
    marginBottom: 12
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #e5e7eb',
    gap: 8,
    marginBottom: 4
  },
  headerCaret: {
    width: 16
  },
  headerEn: {
    flex: 1,
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    userSelect: 'none' as const
  },
  headerArrow: {
    width: 16
  },
  headerEs: {
    flex: 1,
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    userSelect: 'none' as const
  },
  headerAdded: {
    width: 60,
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    textAlign: 'right' as const
  },
  headerActions: {
    width: 52
  },
  wordList: {
    maxHeight: 280,
    overflowY: 'auto',
    marginBottom: 12
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13
  },
  wordItem: {
    borderBottom: '1px solid #f3f4f6'
  },
  wordRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    gap: 8
  },
  caretBtn: {
    width: 16,
    height: 16,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  expandedContent: {
    padding: '8px 0 12px 24px',
    background: '#f9fafb',
    borderRadius: 4,
    marginBottom: 4
  },
  sentenceRow: {
    display: 'flex',
    gap: 24
  },
  sentenceEn: {
    flex: 1,
    fontSize: 12,
    color: '#4b5563',
    fontStyle: 'italic',
    lineHeight: 1.4
  },
  sentenceEs: {
    flex: 1,
    fontSize: 12,
    color: '#6366f1',
    fontStyle: 'italic',
    lineHeight: 1.4
  },
  wordEn: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937'
  },
  wordPos: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: 400
  },
  wordArrow: {
    color: '#9ca3af',
    fontSize: 12
  },
  wordEs: {
    flex: 1,
    fontSize: 13,
    color: '#6366f1',
    fontWeight: 500
  },
  wordAdded: {
    width: 60,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right' as const
  },
  wordActions: {
    display: 'flex',
    gap: 4
  },
  actionBtn: {
    width: 24,
    height: 24,
    border: 'none',
    borderRadius: 4,
    background: '#ecfdf5',
    color: '#10b981',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeBtn: {
    width: 24,
    height: 24,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#9ca3af',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  footer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center'
  }
};

export default IndexPopup;
