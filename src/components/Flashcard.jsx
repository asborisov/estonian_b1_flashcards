import { createMemo } from 'solid-js';
import '../styles/Flashcard.css';

function Flashcard(props) {
  let touchStartX = 0;
  let touchStartY = 0;
  let hasSwiped = false;

  const getDictionaryUrl = (word) => {
    const cleanWord = word.replace(/\s+[A-Z]\s*$/, '');
    const encodedWord = encodeURIComponent(cleanWord);
    return `https://sonaveeb.ee/search/unif/dlall/dsall/${encodedWord}/1/est`;
  };

  const wordDetails = createMemo(() => {
    const match = props.word.match(/(.*?)\s+([A-Z])\s*$/);
    if (match) {
      return {
        mainWord: match[1],
        type: match[2],
      };
    }
    return {
      mainWord: props.word,
      type: '',
    };
  });
  const formsText = createMemo(() => [props.secondForm, props.thirdForm].filter(Boolean).join(' · '));

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    hasSwiped = false;
  };

  const handleTouchEnd = (event) => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    hasSwiped = true;
    if (deltaX < 0) {
      props.onNext();
      return;
    }

    props.onPrevious();
  };

  const handleClick = () => {
    if (hasSwiped) {
      hasSwiped = false;
      return;
    }

    props.onFlip();
  };

  return (
    <div class="flashcard-container">
      <div class={`flashcard-wrapper slide-${props.direction}`}>
        <div
          class="flashcard"
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div class={`flashcard-inner ${props.isFlipped ? 'flipped' : ''}`}>
            <div class="flashcard-front">
              <div class="flashcard-content">
                <div class="main-word">{wordDetails().mainWord}</div>
                {formsText() && <div class="word-forms">{formsText()}</div>}
                <div class="word-type">{wordDetails().type}</div>
              </div>
            </div>
            <div class="flashcard-back">
              <div class="flashcard-content">
                <div class="main-word">{props.translation}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <a
        href={getDictionaryUrl(props.word)}
        target="_blank"
        rel="noopener noreferrer"
        class="dictionary-link"
      >
        Look up in Dictionary
      </a>
    </div>
  );
}

export default Flashcard;
