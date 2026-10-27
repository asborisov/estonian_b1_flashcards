# Estonian Language Flashcards

A web application for learning Estonian vocabulary using flashcards. The app supports both English and Russian translations.

## Features

- Flashcards with Estonian words and their translations
- Support for both English and Russian translations
- Word type indicators (noun, verb, adjective, etc.)
- Keyboard navigation support
- Dictionary lookup links for each word
- Smooth animations for card flipping and transitions
- Mobile-friendly design

## Keyboard Shortcuts

- `→` (Right Arrow): Next card
- `←` (Left Arrow): Previous card
- `↑` (Up Arrow) or `Space`: Flip card

## Word Types Legend

- A – omadussõna (adjective)
- D – määrsõna (adverb)
- G – käändumatu omadussõna (indeclinable adjective)
- I – hüüdsõna (interjection)
- J – sidesõna (conjunction)
- K – kaassõna (postposition/preposition)
- N – põhiarvsõna (cardinal number)
- O – järgarvsõna (ordinal number)
- P – asesõna (pronoun)
- S – nimisõna (noun)
- V – tegusõna (verb)
- Y – lühend (abbreviation)

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`
4. Build for production: `npm run build`

## Technologies Used

- React 18
- Vite
- CSS3 (with animations)

## Development

The application is built using React and Vite. The flashcards support both Russian and English translations of Estonian words. Each word includes its grammatical type indicator, and clicking on a card reveals its translation. The application includes keyboard navigation and smooth animations for a better user experience.

## Dictionary Integration

Each flashcard includes a link to Sonaveeb (Estonian dictionary) for detailed word information. The link is automatically generated based on the Estonian word.

## Contributing

Feel free to submit issues and enhancement requests.

## Acknowledgments

- Dictionary links provided by [Sonaveeb](https://sonaveeb.ee)

## Pronunciation audio

The Listen button plays the Estonian word and every available form in a single
recording. Repeated forms are spoken again. Recordings live in `public/audio/`
and are copied into the GitHub Pages build by Vite. They load only when Listen is
pressed; changing words stops playback. Translation-to-Estonian quizzes show
Listen after the answer has been selected.

`public/audio/manifest.json` maps the exact dictionary keys to MP3 filenames and
records the spoken forms and synthesis settings. Filenames include a hash of the
entry, its forms, and its settings, so changed recordings get new URLs.

To regenerate or resume missing files with the local Docker services running:

```sh
python3 scripts/generate-audio.py
```

After successful generation, the manifest is replaced atomically and obsolete
generated MP3s are removed. Failed runs preserve the previous manifest and recordings.

For two concurrent requests, use `python3 scripts/generate-audio.py --workers 2`
with two worker containers consuming the same TartuNLP queue.

The generator uses `tartunlp-tts-api-1` for synthesis and FFmpeg from
`immich_server` for encoding. No TTS service is needed by the deployed app.
Configuration: Mari, speed 0.9, model pauses between forms separated by full stops,
mono 22,050 Hz, 64 kbps MP3, 65 Hz high-pass, 3 dB FFT denoising and 5 kHz low-pass.
