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

Physical microphone preflight checkpoint, October 5, 2026: the learner reports
that the unpacked extension is loaded and its microphone meter moves while
speaking. This is a user-observed preflight pass, not yet proof of simultaneous
tab/microphone recording, tutor playback, or panel-closure recovery.

Real capture UI checkpoint, October 6, 2026: the learner reports that the short
capture checks pass: both meters respond, saved seconds advance, tutor tones stay
audible, and recording continues after closing and reopening the panel for
30 seconds. These are learner-observed passes. The exported files verified below
are too short to substantiate that panel-closure duration. This does not certify service-worker suspension, track loss,
browser restart, speaker/headphone bleed, or the uninterrupted hour gate.

The initially available WebM in Downloads belonged to the earlier
synthetic benchmark: recording `43d9c406-f29c-434d-9231-74e3fed38cf7`, tab part 0,
61,382 bytes, 15.002 seconds, created October 5, 2026. Its SHA-256 matches the
benchmark receiver's copy and it fully decodes with FFmpeg exit 0. It is excluded
from the new real-capture acceptance evidence.

Real exported-media checkpoint, October 6, 2026: the learner supplied recording
`a2c42d86-d529-4045-92d6-d2bb77256d51`, tab part 0 and microphone part 0. Both
fully decode with FFmpeg 9.0.1 using strict error handling (exit 0), and both
decode to 3.72 seconds. Tab audio is stereo Opus at 48 kHz (15,268 bytes); the
microphone is mono Opus at 48 kHz (14,614 bytes). Measured encoded rates are
32.83/31.43 kbps respectively. These are short-clip observations, not hour limits.

The tab signal contains the expected 440/880 Hz tutor tones. Projection onto
those frequencies over complete 0.5-second windows accounts for about 95.07% of
tab energy versus 0.0162% of microphone energy; the microphone signal is nonzero
and varies independently. This supports separate captured inputs with low tone
spill for this sample. It does not prove every speaker/headphone configuration.
Aggregate measurements and file hashes are in
`spike-evidence/2026-10-06-real-capture-a2c42d86.json`; audio remains outside Git.

No recording manifest or additional parts have been supplied. Obtain the
manifest to check fragment/assembled-part checksums, gaps, saved duration and
whether a different or longer recording covered panel closure. A 3.72-second
pair cannot prove the 30-second panel-closure sequence. Keep that timing gate,
real interruption recovery and the uninterrupted hour gate open. If Chrome
blocks additional downloads, allow the test exports and export again.

Run `node scripts/serve-class-spike.mjs` from this checkout for a standalone
classroom fixture on `http://127.0.0.1:4179/`. It plays quiet alternating 440/880 Hz
tones through the real tab output and never obtains a microphone stream. The
extension must obtain the tab stream through its actual toolbar/Record flow.
This fixture does not instantiate the recorder or replace capture with synthetic
MediaStreams. Use headphones, close the microphone-preflight tab, then invoke
Schwanki's toolbar button on the tone-playing tab before pressing Record.
Keep the loaded extension build unchanged throughout this capture.

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

October 6, 2026 checkpoint: the learner supplied extension ID
`dcjccanbkpplkimkkjdcgcggopaanmdh`; Chrome's tab inventory confirms its extension
details page is open. The ID is configured in the ignored local web-app allowlist.
The local classroom fixture was opened and its Play tutor tones control shows
the playing state. This does not establish that the tutor remains audible during
capture. The browser controller blocks `chrome-extension://` navigation, so the
learner must operate the toolbar and recording panel for the acceptance check;
no alternate capture or bridge was used to bypass that restriction.

The same generated multilingual fixtures were retried on October 6. Both models
still returned HTTP 401 `missing_permissions` for both samples. The transcription
gate remains open. A new local manifest-export control verifies fragment hashes
and records assembled-part hashes and explicit pause gaps for comparison with
exported audio. Its loaded-extension behavior remains pending a completed capture
and extension reload; do not reload an extension while it is recording.

Task 2's shared schema/transactional approval and provider-independent extraction
validation were implemented while capture was running. Shared auth handoff
scaffolding validates the exact web-app origin/path and allowlisted extension ID.
Task 1 still gates the provider/runtime/price decision. Control API, remote upload,
leased processing worker, regeneration, full class PWA pages, credit reservations,
BYOK capability coverage and release dogfooding remain unimplemented. Do not enable
paid processing or represent mocked fixtures as acceptance evidence.
