#!/usr/bin/env python3
"""Generate resumable dictionary audio using the local TartuNLP Docker API."""
import argparse, concurrent.futures, hashlib, json, pathlib, re, subprocess, time
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/audio'
SETTINGS = dict(voice='mari', speed=0.9, bitrate=64,
                filters='highpass=f=65,afftdn=nr=3:nf=-35:tn=1,lowpass=f=5000',
                pauses='natural; forms separated by full stops')

def generate(text):
    data = json.dumps(dict(text=text, speaker='mari', speed=0.9)).encode()
    code = 'import urllib.request,sys;sys.stdout.buffer.write(urllib.request.urlopen(urllib.request.Request("http://localhost:8000/v2",data='+repr(data)+',headers={"Content-Type":"application/json"}),timeout=300).read())'
    wav = subprocess.run(['docker','exec','tartunlp-tts-api-1','python','-c',code], capture_output=True, check=True, timeout=310).stdout
    return subprocess.run(['docker','exec','-i','immich_server','ffmpeg','-v','error','-i','pipe:0','-af',SETTINGS['filters'],'-ac','1','-ar','22050','-codec:a','libmp3lame','-b:a','64k','-f','mp3','pipe:1'], input=wav,capture_output=True,check=True,timeout=60).stdout

def process_entry(item):
    word, entry = item
    path = OUTPUT / entry['file']
    for attempt in range(3):
        try:
            audio = generate(entry['text'])
            if len(audio) < 1000:
                raise ValueError('Empty audio')
            path.with_suffix('.tmp').write_bytes(audio)
            path.with_suffix('.tmp').replace(path)
            return word
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, choices=(1, 2), default=1,
                        help='Concurrent API requests; two requires two TTS workers')
    args = parser.parse_args()
    words = json.loads((ROOT/'src/data/words_combined.json').read_text())
    OUTPUT.mkdir(parents=True,exist_ok=True)
    entries = {}
    for word, details in words.items():
        forms = [re.sub(r'\s+[A-Z]\s*$', '', word)] + [details[k] for k in ('secondForm','thirdForm') if details.get(k)]
        text = '. '.join(forms) + '.'
        digest = hashlib.sha256(json.dumps([word,forms,SETTINGS],ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:24]
        entries[word] = dict(file=digest+'.mp3',forms=forms,text=text)
    manifest = dict(settings=SETTINGS,entries=entries)
    pending = [(word, entry) for word, entry in entries.items()
               if not (OUTPUT / entry['file']).exists()]
    initial = len(entries) - len(pending)
    start = time.monotonic()
    generated = 0
    print(json.dumps(dict(resumed=initial, remaining=len(pending), workers=args.workers)), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_entry, item): item[0] for item in pending}
        for future in concurrent.futures.as_completed(futures):
            word = future.result()
            generated += 1
            completed = initial + generated
            if generated % 25 == 0 or completed == len(entries):
                elapsed = time.monotonic() - start
                size = sum(p.stat().st_size for p in OUTPUT.glob('*.mp3'))
                print(json.dumps(dict(completed=completed, total=len(entries), generated=generated,
                                      megabytes=round(size / 1e6, 2), elapsed_seconds=round(elapsed),
                                      eta_seconds=round(elapsed / generated * (len(entries) - completed)),
                                      last=word)), flush=True)
    # Publish only after generation succeeds, then remove obsolete generated files.
    manifest_tmp = OUTPUT / 'manifest.json.tmp'
    manifest_tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    manifest_tmp.replace(OUTPUT / 'manifest.json')
    expected = {entry['file'] for entry in entries.values()}
    removed = 0
    for path in OUTPUT.glob('*.mp3'):
        if re.fullmatch(r'[a-f0-9]{24}\.mp3', path.name) and path.name not in expected:
            path.unlink()
            removed += 1
    print(json.dumps(dict(obsolete_recordings_removed=removed)), flush=True)
    print('DONE',flush=True)
if __name__=='__main__': main()
