import { useEffect, useState, useRef } from 'react';
import { getState, setState, addWord, removeWord, setApiKey, translateWord, type UserState } from './lib/storage';

function IndexPopup() {
  const [state, setLocalState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEn, setNewEn] = useState('');
  const [newEs, setNewEs] = useState('');
  const [translating, setTranslating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    loadState();
  }, []);

  useEffect(() => {
    if (!state?.deeplApiKey || !newEn.trim()) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      setTranslating(true);
      const result = await translateWord(newEn.trim(), state.deeplApiKey!);
      if (result) {
        setNewEs(result);
      }
      setTranslating(false);
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [newEn, state?.deeplApiKey]);

  async function loadState() {
    const s = await getState();
    setLocalState(s);
    setApiKeyInput(s.deeplApiKey || '');
    setLoading(false);
  }

  async function updateEnabled(enabled: boolean) {
    await setState({ enabled });
    setLocalState(prev => prev ? { ...prev, enabled } : null);
  }

  async function handleSaveApiKey() {
    await setApiKey(apiKeyInput.trim());
    setLocalState(prev => prev ? { ...prev, deeplApiKey: apiKeyInput.trim() } : null);
    setShowSettings(false);
  }

  async function handleAdd() {
    if (newEn.trim() && newEs.trim()) {
      const en = newEn.trim().toLowerCase();
      const es = newEs.trim();
      await addWord(en, es);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SWAPAROO_ADD_WORD_DIRECT',
          word: en,
          translation: es
        });
      }
      setNewEn('');
      setNewEs('');
      await loadState();
    }
  }

  async function handleRemove(en: string) {
    await removeWord(en);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SWAPAROO_REMOVE_WORD',
        word: en.toLowerCase()
      });
    }
    await loadState();
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleAdd();
    }
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
        </div>
      )}

      <div style={styles.addForm}>
        <input
          type="text"
          placeholder="English"
          value={newEn}
          onChange={(e) => setNewEn(e.target.value)}
          onKeyDown={handleKeyDown}
          style={styles.formInput}
        />
        <input
          type="text"
          placeholder={translating ? 'Translating...' : 'Spanish'}
          value={newEs}
          onChange={(e) => setNewEs(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            ...styles.formInput,
            ...(translating ? styles.inputTranslating : {})
          }}
        />
        <button onClick={handleAdd} style={styles.addBtn}>+</button>
      </div>

      {!state.deeplApiKey && (
        <div style={styles.hint}>
          Add a DeepL API key in settings for auto-translation
        </div>
      )}

      <div style={styles.wordList}>
        {state.words.length === 0 ? (
          <div style={styles.empty}>No words yet. Add some above.</div>
        ) : (
          state.words.map(({ en, es }) => (
            <div key={en} style={styles.wordRow}>
              <span style={styles.wordEn}>{en}</span>
              <span style={styles.wordArrow}>→</span>
              <span style={styles.wordEs}>{es}</span>
              <button
                onClick={() => handleRemove(en)}
                style={styles.removeBtn}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div style={styles.footer}>
        {state.words.length} word{state.words.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  popup: {
    width: 320,
    padding: 16,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: '#fff'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  addForm: {
    display: 'flex',
    gap: 8,
    marginBottom: 8
  },
  formInput: {
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const
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
  inputTranslating: {
    color: '#9ca3af'
  },
  hint: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 12,
    textAlign: 'center'
  },
  addBtn: {
    flexShrink: 0,
    width: 36,
    border: 'none',
    borderRadius: 6,
    background: '#6366f1',
    color: 'white',
    fontSize: 18,
    cursor: 'pointer'
  },
  wordList: {
    maxHeight: 300,
    overflowY: 'auto',
    marginBottom: 12
  },
  empty: {
    padding: 16,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13
  },
  wordRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    gap: 8
  },
  wordEn: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937'
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
