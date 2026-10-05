# Recorded class capture spike

Date: October 5, 2026. Status: capture prototype and provider-independent contracts;
**Task 1 is not yet passed. This is not a release-ready connector.**

## Browser/API decisions

Chrome minimum: 116. The official tabCapture reference permits a stream ID
obtained in the service worker to be consumed in an offscreen document from that
version. Capture requires invoking the extension on the classroom tab. There is
no classroom content script and no classroom host permission in this spike.

Capture is explicit. The visible preflight page requests microphone permission
and shows a meter. The offscreen document owns both streams. A microphone denial
is resolved before obtaining the tab stream. Tab capture suppresses normal tab
playback; the recorder connects the tab MediaStream to AudioContext.destination
and resumes that context. The microphone is never routed to the speakers.

The code requests separate 32 kbps Opus WebM channels. It records the actual
MediaRecorder MIME type rather than assuming an encoder. A five-second timeslice
is a transport/storage fragment, **not** an independently decodable audio file.
Pause stops both recorders; resume creates new parts with new headers and records
the wall-time gap. Ordered fragments within each part must be concatenated and
then decoded/remuxed before transcription.

References read on October 5, 2026:

- https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- https://developer.chrome.com/docs/extensions/reference/api/offscreen
- https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture
- https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle

## Actual browser evidence

Real Chrome, local development benchmark using the production recorder with two
synthetic Web Audio streams (440 Hz and 660 Hz):

| Check | Result |
| --- | --- |
| 15-second capture, both channels | 122,686 total bytes saved to IndexedDB |
| Microphone synthetic part | 61,304 bytes, three fragments, 15.0 seconds decoded |
| Classroom synthetic part | 61,382 bytes, three fragments, 15.0 seconds decoded |
| Actual MIME/sample rate | audio/webm;codecs=opus, 48,000 Hz |
| 32-minute attempted hour capture | 1,920,228.6 ms saved; 15,757,525 bytes across both channels; interrupted by fixture live reload |
| Static attempted hour capture | 655,236.4 ms saved; 5,376,140 bytes; recording tab closed before completion |
| Final 30-second static capture | 245,782 bytes; both parts decoded to 30.0 seconds |
| Actual pause/resume/stop | Four complete parts decoded; 59,630.3 ms explicit gap; 45.06 + 15.24 seconds of speech per stream |
| Static capture JavaScript heap | Baseline 32,272,830 bytes, observed peak 32,272,830, about 16.7–19.7 MB between sampled checks; native encoder memory not measured |
| Recovery/transport | All six original saved parts transferred to the loopback receiver with matching byte counts and SHA-256 receipts |
| FFmpeg decode/remux | All six original parts decoded with exit 0; interrupted WebM reported premature end; remuxed output decoded cleanly |

This verifies Chrome encoding, local writes, part assembly, pause boundaries and
decoding. Fixtures are available through benchmark.html and export.html in the
static spike build. Live reload interrupted the first long run; the second used
a static build and ended when its recording tab closed. Completed fragments
survived both interruptions.
It does **not** certify tabCapture, physical microphone recording, tutor audibility,
headphone/speaker bleed, panel closure or service-worker suspension. The browser
connection cannot load the unpacked extension through chrome://extensions; the
user has been asked to load apps/extension/dist and provide its ID.

Conservative development ceilings: 60 minutes, 128 MiB across both channels,
five-second fragments. These are not measured production pricing/limit promises.
Native encoder memory, production storage upload and full-hour remux throughput
remain separate measurement gates. The longest saved channel decoded in 5.2–7.0
seconds; its complete-fragment prefix was remuxed successfully. These interrupted
runs do not pass the uninterrupted hour gate. Do not infer a full hour from their
combined duration. Audio is local only; no server acknowledgment
or remote upload is claimed by the current UI.

## Multilingual transcription attempt

Generated, non-private Mandarin/English and Thai/English samples were created
with the installed macOS Tingting, Kanya and Samantha voices. FFmpeg 16 kHz mono
WAV assembly succeeded. These fixtures include teaching, grammar and an explicit
English correction; they do not substitute for a consented real class.

Both scribe_v1 and scribe_v2 were attempted against the official ElevenLabs
speech-to-text endpoint. All four requests returned HTTP 401: the configured key
lacks **speech_to_text** permission. No transcript, timestamp-quality comparison,
usage measurement, retention decision or provider selection is supported yet.
The key was not printed or persisted in artifacts. Enable that permission or
configure a transcription-capable key locally before rerunning the comparison.

Official API reference:
https://elevenlabs.io/docs/api-reference/speech-to-text/convert

A media-capable FFmpeg process is required to assemble/remux independent parts
and segment large media; raw transport fragments must never be sent as complete
files. Node plus FFmpeg is a candidate runtime, not yet a benchmark-selected
production worker. Edge request execution is not a suitable home for an entire
hour-long capture/transcription job.

## Run and verify

Use RUNBOOK.md and the pinned pnpm version. Build the extension, load
apps/extension/dist unpacked, open the classroom tab, click the toolbar action,
run microphone preflight, acknowledge participant consent and press Record.
Both meters must respond; tutor audio must remain audible. Close the panel for a
minute, reopen it and confirm duration advances. Pause/resume must create separate
complete parts. Stop, export parts, decode each complete part with FFmpeg.

- Test headphones and speakers separately; check microphone bleed.
- Suspend the service worker while the offscreen document records.
- Close the classroom tab; confirm an interrupted manifest and completed fragments.
- Restart Chrome; confirm live capture is not restored or claimed.
- Fill storage/fail IndexedDB; confirm capture stops and saved fragments remain.
- Preserve unuploaded chunks. Deletion requires an explicit learner action.
- Test a consented real multilingual class once capture and provider gates pass.

## Remaining plan scope

Task 2's shared schema/transactional approval and provider-independent extraction
validation were implemented while capture was running. Shared auth handoff
scaffolding validates the exact web-app origin/path and allowlisted extension ID.
Task 1 still gates the provider/runtime/price decision. Control API, remote upload,
leased processing worker, regeneration, full class PWA pages, credit reservations,
BYOK capability coverage and release dogfooding remain unimplemented. Do not enable
paid processing or represent mocked fixtures as acceptance evidence.
