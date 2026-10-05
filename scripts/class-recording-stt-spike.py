#!/usr/bin/env python3
"""Compare timestamped transcription on explicit local, consented test audio.

No secret is printed. The result directory contains transcript text: keep real
class results outside Git. A provider/key failure is reported, never substituted
with a platform-paid key. See docs/class-recording-spike.md.
"""
import argparse
import json
import os
from pathlib import Path
import shlex
import time
import urllib.error
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audio-dir', type=Path, required=True)
    parser.add_argument('--env-file', type=Path)
    args = parser.parse_args()
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key and args.env_file:
        for line in args.env_file.read_text().splitlines():
            if line.startswith('ELEVENLABS_API_KEY='):
                values = shlex.split(line.split('=', 1)[1])
                key = values[0] if values else None
    if not key:
        raise SystemExit('Transcription key unavailable. No requests made.')
    results = []
    for sample in ('zh-en', 'th-en'):
        audio = (args.audio_dir / f'{sample}.wav').read_bytes()
        for model in ('scribe_v1', 'scribe_v2'):
            boundary = 'schwanki-' + uuid.uuid4().hex
            fields = {'model_id': model, 'timestamps_granularity': 'word',
                      'diarize': 'false', 'tag_audio_events': 'false'}
            body = b''
            for name, value in fields.items():
                body += (f'--{boundary}\r\nContent-Disposition: form-data; '
                         f'name="{name}"\r\n\r\n{value}\r\n').encode()
            body += (f'--{boundary}\r\nContent-Disposition: form-data; '
                     f'name="file"; filename="{sample}.wav"\r\n'
                     'Content-Type: audio/wav\r\n\r\n').encode()
            body += audio + f'\r\n--{boundary}--\r\n'.encode()
            request = urllib.request.Request(
                'https://api.elevenlabs.io/v1/speech-to-text', data=body,
                headers={'xi-api-key': key,
                         'Content-Type': 'multipart/form-data; boundary=' + boundary},
                method='POST')
            started = time.monotonic()
            summary = {'sample': sample, 'model': model}
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    payload = json.load(response)
                words = payload.get('words', [])
                summary.update(latencySeconds=round(time.monotonic() - started, 2),
                               wordCount=len(words),
                               timestampedWords=sum('start' in w and 'end' in w for w in words))
                (args.audio_dir / f'{sample}-{model}.json').write_text(
                    json.dumps(payload, ensure_ascii=False, indent=2))
            except urllib.error.HTTPError as error:
                detail = json.loads(error.read()).get('detail', {})
                summary.update(httpStatus=error.code, reason=detail.get('status', 'provider_error'))
            results.append(summary)
            print(json.dumps(summary), flush=True)
    (args.audio_dir / 'comparison.json').write_text(json.dumps(results, indent=2))
    if any('httpStatus' in r for r in results):
        raise SystemExit('Transcription comparison incomplete: resolve provider failures first.')


if __name__ == '__main__':
    main()
