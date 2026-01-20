import { useState, useEffect } from 'react';
import nlp from 'compromise';
import { translateWithSentence } from '../lib/storage';

export interface TranslateResult {
  word: string | null;
  sentence: string | null;
}

export interface AddWordModalProps {
  apiKey?: string;
  onAdd: (en: string, es: string, pos?: string, sentenceEn?: string, sentenceEs?: string) => void;
  onClose: () => void;
  // Optional custom translate function (for CSUI which needs message passing)
  onTranslate?: (word: string, sentence: string, direction: 'en-to-es' | 'es-to-en') => Promise<TranslateResult>;
  // For pre-filled mode (from page selection)
  initialWord?: string;
  initialSentence?: string;
  initialDirection?: 'en-to-es' | 'es-to-en';
  initialPos?: string;
  readOnlySource?: boolean;
  // Error message to display
  error?: string | null;
}

export function AddWordModal({
  apiKey,
  onAdd,
  onClose,
  onTranslate,
  initialWord = '',
  initialSentence = '',
  initialDirection = 'en-to-es',
  initialPos = '',
  readOnlySource = false,
  error: externalError = null
}: AddWordModalProps) {
  const [direction, setDirection] = useState<'en-to-es' | 'es-to-en'>(initialDirection);
  const [sourceWord, setSourceWord] = useState(initialWord);
  const [sourceSentence, setSourceSentence] = useState(initialSentence);
  const [targetWord, setTargetWord] = useState('');
  const [targetSentence, setTargetSentence] = useState('');
  const [pos, setPos] = useState(initialPos);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

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

  async function runTranslation() {
    if (!sourceWord.trim()) return;
    // Need either apiKey (for direct translation) or onTranslate callback
    if (!apiKey && !onTranslate) return;

    setTranslating(true);
    setTranslateError(null);

    // Detect POS if not already set and source is English
    if (!pos && direction === 'en-to-es') {
      const detected = detectPartOfSpeech(sourceWord.trim());
      if (detected) setPos(detected);
    }

    const word = sourceWord.trim();
    const sentence = sourceSentence.trim() || word;

    try {
      let result: TranslateResult;
      if (onTranslate) {
        // Use custom translate function (for CSUI)
        result = await onTranslate(word, sentence, direction);
      } else {
        // Use direct API call (for popup)
        result = await translateWithSentence(word, sentence, apiKey!, direction);
      }
      setTargetWord(result.word || '');
      setTargetSentence(result.sentence || '');
    } catch (err) {
      console.error('Translation error:', err);
      const message = err instanceof Error ? err.message : 'Translation failed. Check your API key in settings.';
      setTranslateError(message);
    }
    setTranslating(false);
  }

  // Auto-translate when in readOnlySource mode (from page)
  useEffect(() => {
    if (readOnlySource && initialWord && (apiKey || onTranslate)) {
      runTranslation();
    }
  }, []);

  function handleDirectionChange(newDirection: 'en-to-es' | 'es-to-en') {
    if (direction === newDirection) return;

    setDirection(newDirection);

    if (readOnlySource) {
      // Re-translate with new direction
      setTargetWord('');
      setTargetSentence('');
      setTimeout(() => {
        runTranslation();
      }, 0);
    } else {
      // Clear fields for manual entry
      setSourceWord('');
      setSourceSentence('');
      setTargetWord('');
      setTargetSentence('');
      setPos('');
    }
  }

  // Need to update runTranslation to use current direction
  useEffect(() => {
    if (readOnlySource && sourceWord && (apiKey || onTranslate) && !translating && !targetWord) {
      runTranslation();
    }
  }, [direction]);

  function handleTranslate() {
    runTranslation();
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
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.title}>{readOnlySource ? 'Add to Swaparoo' : 'Add New Word'}</h3>

        {(externalError || translateError) && (
          <div style={styles.error}>{externalError || translateError}</div>
        )}

        <div style={styles.directionRow}>
          <span style={styles.directionLabel}>Translating from:</span>
          <button
            style={{
              ...styles.directionBtn,
              ...(direction === 'en-to-es' ? styles.directionBtnActive : {})
            }}
            onClick={() => handleDirectionChange('en-to-es')}
          >
            English
          </button>
          <button
            style={{
              ...styles.directionBtn,
              ...(direction === 'es-to-en' ? styles.directionBtnActive : {})
            }}
            onClick={() => handleDirectionChange('es-to-en')}
          >
            Spanish
          </button>
        </div>

        <div style={styles.columns}>
          <div style={styles.column}>
            <label style={styles.label}>
              {sourceLabel} {readOnlySource ? '(source)' : '(editable)'}
            </label>
            <input
              type="text"
              placeholder="Word"
              value={sourceWord}
              onChange={e => !readOnlySource && setSourceWord(e.target.value)}
              readOnly={readOnlySource}
              style={{
                ...styles.input,
                ...(readOnlySource ? styles.inputReadOnly : {})
              }}
            />
            <textarea
              placeholder="Sentence (optional)"
              value={sourceSentence}
              onChange={e => !readOnlySource && setSourceSentence(e.target.value)}
              readOnly={readOnlySource}
              style={{
                ...styles.textarea,
                ...(readOnlySource ? styles.inputReadOnly : {})
              }}
              rows={2}
            />
          </div>

          <div style={styles.arrow}>→</div>

          <div style={styles.column}>
            <label style={styles.label}>{targetLabel} (translated)</label>
            <input
              type="text"
              placeholder={translating ? 'Translating...' : 'Word'}
              value={targetWord}
              readOnly
              style={{ ...styles.input, ...styles.inputReadOnly }}
            />
            <textarea
              placeholder={translating ? 'Translating...' : 'Sentence'}
              value={targetSentence}
              readOnly
              style={{ ...styles.textarea, ...styles.inputReadOnly }}
              rows={2}
            />
          </div>
        </div>

        <div style={styles.posRow}>
          <span style={styles.posLabel}>Part of speech:</span>
          <select
            value={pos}
            onChange={e => setPos(e.target.value)}
            style={styles.posSelect}
          >
            <option value="">—</option>
            <option value="noun">noun</option>
            <option value="verb">verb</option>
            <option value="adj">adjective</option>
            <option value="adv">adverb</option>
          </select>
        </div>

        <div style={styles.buttons}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          {!readOnlySource && (
            <button
              onClick={handleTranslate}
              disabled={(!apiKey && !onTranslate) || !sourceWord.trim() || translating}
              style={styles.translateBtn}
            >
              {translating ? 'Translating...' : 'Translate'}
            </button>
          )}
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            style={{
              ...styles.addBtn,
              ...(canAdd ? {} : styles.addBtnDisabled)
            }}
          >
            Add
          </button>
        </div>

        {!apiKey && !onTranslate && (
          <div style={styles.hint}>
            Add a DeepL API key in settings for auto-translation
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    zIndex: 9999999,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
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
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    padding: '8px 12px',
    marginBottom: 16,
    fontSize: 12,
    color: '#dc2626'
  }
};

export default AddWordModal;
