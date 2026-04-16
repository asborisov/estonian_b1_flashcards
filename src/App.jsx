import { Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import Flashcard from './components/Flashcard';
import wordsUrl from './data/words_combined.json?url';
import './App.css';

function App() {
  const [words, setWords] = createSignal([]);
  const [wordOrder, setWordOrder] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [isFlipped, setIsFlipped] = createSignal(false);
  const [direction, setDirection] = createSignal('right');
  const [language, setLanguage] = createSignal('est');
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false);
  const currentWord = createMemo(() => {
    const order = wordOrder();
    const items = words();
    return items[order[currentIndex()]];
  });

  const shuffleIndexes = (length) => {
    const indexes = Array.from({ length }, (_, index) => index);

    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [indexes[index], indexes[randomIndex]] = [indexes[randomIndex], indexes[index]];
    }

    return indexes;
  };

  const handleNext = () => {
    const order = wordOrder();
    if (!order.length) {
      return;
    }
    setDirection('right');
    setCurrentIndex((prevIndex) => (prevIndex + 1) % order.length);
    setIsFlipped(false);
  };

  const handlePrevious = () => {
    const order = wordOrder();
    if (!order.length) {
      return;
    }
    setDirection('left');
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? order.length - 1 : prevIndex - 1));
    setIsFlipped(false);
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsDropdownOpen(false);
  };

  onMount(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'ArrowRight') {
        handleNext();
      } else if (event.key === 'ArrowLeft') {
        handlePrevious();
      } else if (event.key === 'ArrowUp' || event.key === ' ') {
        event.preventDefault();
        handleFlip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyPress);
    });
  });

  onMount(async () => {
    try {
      const response = await fetch(wordsUrl);
      if (!response.ok) {
        throw new Error(`Failed to load words: ${response.status}`);
      }
      const data = await response.json();
      const items = Object.entries(data).map(([word, details]) => ({
        word,
        ...details,
      }));
      setWords(items);
      setWordOrder(shuffleIndexes(items.length));
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load words.');
    } finally {
      setLoading(false);
    }
  });

  return (
    <div class="app">
      <div class="header">
        <h1>Estonian B1 Exam Flashcards</h1>
        <div class="language-dropdown">
          <button
            class="dropdown-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen())}
          >
            {language() === 'est' ? 'Русский' : 'English'} ▼
          </button>
          {isDropdownOpen() && (
            <div class="dropdown-content">
              <button
                classList={{ active: language() === 'est' }}
                onClick={() => handleLanguageChange('est')}
              >
                Русский
              </button>
              <button
                classList={{ active: language() === 'eng' }}
                onClick={() => handleLanguageChange('eng')}
              >
                English
              </button>
            </div>
          )}
        </div>
      </div>

      {loading() && <p class="status-message">Loading words...</p>}
      {error() && <p class="status-message error-message">{error()}</p>}

      {!loading() && !error() && currentWord() && (
        <div class="flashcard-section">
          <Show when={currentWord()} keyed>
            {(word) => (
              <Flashcard
                word={word.word}
                secondForm={word.secondForm}
                thirdForm={word.thirdForm}
                translation={
                  language() === 'est'
                    ? word.ruTranslation
                    : word.enTranslation
                }
                isFlipped={isFlipped()}
                onFlip={handleFlip}
                onNext={handleNext}
                onPrevious={handlePrevious}
                direction={direction()}
              />
            )}
          </Show>
          <div class="navigation-buttons">
            <button
              onClick={handlePrevious}
              class="arrow-button"
              title="Previous (←)"
            >
              ←
            </button>
            <button
              onClick={handleFlip}
              class="action-button flip-button"
              title="Flip (↑ or Space)"
            >
              Flip
            </button>
            <button
              onClick={handleNext}
              class="arrow-button"
              title="Next (→)"
            >
              →
            </button>
          </div>
        </div>
      )}

      <footer class="legend">
        <h2>Word Types:</h2>
        <div class="legend-grid">
          <div><strong>A</strong> – omadussõna</div>
          <div><strong>D</strong> – määrsõna</div>
          <div><strong>G</strong> – käändumatu omadussõna</div>
          <div><strong>I</strong> – hüüdsõna</div>
          <div><strong>J</strong> – sidesõna</div>
          <div><strong>K</strong> – kaassõna</div>
          <div><strong>N</strong> – põhiarvsõna</div>
          <div><strong>O</strong> – järgarvsõna</div>
          <div><strong>P</strong> – asesõna</div>
          <div><strong>S</strong> – nimisõna</div>
          <div><strong>V</strong> – tegusõna</div>
          <div><strong>Y</strong> – lühend</div>
        </div>
      </footer>
    </div>
  );
}

export default App;
