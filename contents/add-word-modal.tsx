import type { PlasmoCSConfig, PlasmoGetStyle } from 'plasmo';
import { useState, useEffect } from 'react';
import { AddWordModal, TranslateResult } from '../components/AddWordModal';
import { addWord, getState } from '../lib/storage';

// Toggle to simulate errors for testing (set to false for production)
const SIMULATE_ERRORS = {
  getState: false,   // Error #1: Storage read failure
  addWord: false,    // Error #2: Storage write failure
  translate: false   // Error #3: Translation message failure
};

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle'
};

// Plasmo injects styles into shadow DOM
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement('style');
  style.textContent = `
    .plasmo-csui-container {
      z-index: 9999999 !important;
    }
  `;
  return style;
};

interface ModalData {
  word: string;
  sentence: string;
  direction: 'en-to-es' | 'es-to-en';
  pos: string;
}

function AddWordModalOverlay() {
  const [visible, setVisible] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [apiKey, setApiKey] = useState<string | undefined>();
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    // Load API key
    (async () => {
      try {
        if (SIMULATE_ERRORS.getState) {
          throw new Error('Simulated storage read failure');
        }
        const state = await getState();
        setApiKey(state.deeplApiKey);
      } catch (err) {
        console.error('Failed to load settings:', err);
        setFatalError('Failed to load settings. Try reloading the page.');
      }
    })();

    // Listen for messages to show modal
    const handleMessage = (message: any) => {
      if (message.type === 'SWAPAROO_SHOW_ADD_MODAL') {
        setModalData({
          word: message.word || '',
          sentence: message.sentence || '',
          direction: message.direction || 'en-to-es',
          pos: message.pos || ''
        });
        setVisible(true);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  async function handleTranslate(
    word: string,
    sentence: string,
    direction: 'en-to-es' | 'es-to-en'
  ): Promise<TranslateResult> {
    if (SIMULATE_ERRORS.translate) {
      throw new Error('Simulated translation failure');
    }
    const response = await chrome.runtime.sendMessage({
      type: 'SWAPAROO_TRANSLATE_WITH_SENTENCE',
      word,
      sentence,
      direction
    });
    if (response?.error) {
      throw new Error(response.error);
    }
    if (!response || (!response.word && !response.sentence)) {
      throw new Error('Translation failed. Check your API key in settings.');
    }
    return {
      word: response.word || null,
      sentence: response.sentence || null
    };
  }

  async function handleAdd(en: string, es: string, pos?: string, sentenceEn?: string, sentenceEs?: string) {
    setAddError(null);
    try {
      if (SIMULATE_ERRORS.addWord) {
        throw new Error('Simulated storage write failure');
      }
      await addWord(en, es, pos, sentenceEn, sentenceEs);

      // Notify the swap content script to update
      window.postMessage({
        type: 'SWAPAROO_WORD_ADDED',
        word: en,
        translation: es
      }, '*');

      setVisible(false);
      setModalData(null);
    } catch (err) {
      console.error('Failed to save word:', err);
      setAddError('Failed to save word. Try again or reload the page.');
    }
  }

  function handleClose() {
    setVisible(false);
    setModalData(null);
  }

  if (!visible || !modalData) {
    return null;
  }

  // Show simplified error view if settings failed to load
  if (fatalError) {
    return (
      <div style={errorOverlayStyles.overlay} onClick={handleClose}>
        <div style={errorOverlayStyles.modal} onClick={e => e.stopPropagation()}>
          <h3 style={errorOverlayStyles.title}>Add to Swaparoo</h3>
          <div style={errorOverlayStyles.error}>{fatalError}</div>
          <div style={errorOverlayStyles.buttons}>
            <button onClick={handleClose} style={errorOverlayStyles.cancelBtn}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AddWordModal
      apiKey={apiKey}
      onAdd={handleAdd}
      onClose={handleClose}
      onTranslate={handleTranslate}
      initialWord={modalData.word}
      initialSentence={modalData.sentence}
      initialDirection={modalData.direction}
      initialPos={modalData.pos}
      readOnlySource={true}
      error={addError}
    />
  );
}

const errorOverlayStyles: Record<string, React.CSSProperties> = {
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
    width: 320,
    textAlign: 'center'
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2937'
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    padding: '12px 16px',
    marginBottom: 16,
    fontSize: 13,
    color: '#dc2626'
  },
  buttons: {
    display: 'flex',
    justifyContent: 'center'
  },
  cancelBtn: {
    padding: '8px 24px',
    border: 'none',
    borderRadius: 6,
    background: '#f3f4f6',
    color: '#374151',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  }
};

export default AddWordModalOverlay;
