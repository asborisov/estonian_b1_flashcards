# Estonian dictionary recordings

One MP3 per dictionary entry, with the main word followed by each available
form, including repetitions. `manifest.json` maps exact dictionary keys to files.

Generated locally with TartuNLP text-to-speech-worker v3.1.0 (multispeaker model),
voice **mari**, speed **0.9**. Full stops between forms give the model its natural
pauses; no silence is inserted afterwards.

Encoding: mono 22,050 Hz MP3, 64 kbps. FFmpeg filters:

```
highpass=f=65,afftdn=nr=3:nf=-35:tn=1,lowpass=f=5000
```

Regenerate with `python3 scripts/generate-audio.py` from the repository root.
The command resumes existing recordings. Run `npm run check:audio` to verify
coverage, forms, file uniqueness and every MP3 frame's encoding and integrity.
MP3s are stored directly in Git and served as static files by GitHub Pages.
