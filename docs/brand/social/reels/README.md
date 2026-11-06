# Vocab reels pipeline

Short vertical reels (12 to 16 s, 1080x1920, 24 fps) that teach one word or phrase and end on the Schwanki end card. Formats, cadence and the backlog live in the Claude Doc "Vocab reels: formats and backlog". Nothing made here is ever scheduled or posted without YJ approving the exact reel.

This folder holds the parts that run locally:

- `render.mjs` turns a spec (`specs/<id>.json`) into transparent 1080x1920 sticker PNGs and a 3.125 s `endcard.mp4`.
- `endcard/` is the animated end card template (phone with the episode's card swiping to the next card, goose crest, "Doom Scroll your Vocab").
- `specs/03-ahorita.json` is the capybara episode, a complete example.

```sh
cd docs/brand/social/reels
npm install                      # fonts only; playwright comes from the global install
node render.mjs specs/03-ahorita.json   # writes out/03-ahorita/{s1..s5.png, endcard.mp4, endcard-last.png}
```

## Spec

```jsonc
{
  "id": "03-ahorita",
  "lang": "ES",            // ZH | JA | KO pick the CJK font; anything else is Latin
  "stickers": {            // one PNG per key; each holds a list of elements
    "s1": [
      { "type": "top", "text": "How Mexicans say<br>“never”" },                 // hook, top 130
      { "type": "sub", "native": "¿Ya vas…?", "roman": "", "en": "“…”", "rot": 2 } // subtitle, top 1330
    ],
    "s5": [{ "type": "payoff", "native": "ahorita", "roman": "ah-oh-REE-tah",
             "lines": ["says “right now”", "means “maybe never”"] }]               // top 1150
    // also: { "type": "html", "html": "<div class='slot' style='top:…'>…</div>" }
    // any element takes "top", "rot"; sub/payoff take "size" (px of the native line)
  },
  "endcard": { "image": "img/03-ahorita.jpg", "pill": "ES · YOUR VOCABULARY",
               "word": "ahorita", "mean": "right now (maybe never)",
               "sent": "<b>Ahorita</b> lavo los platos.", "tr": "I’ll do the dishes right now. (I won’t.)" }
}
```

Wrap the target word in `<span class="hl">…</span>` to get the yellow highlighter. Keep subtitles off faces: the default subtitle slot (top 1330) suits subjects in the upper two thirds; move it with `"top"` otherwise.

## Sume recipe (about $1.80 a reel)

All generation goes through the Sume MCP. Never use Kling; video is MiniMax H3 (or Wan 3.0).

1. **Keyframes**: `openai/gpt-image-2.5`, 9:16, quality medium, no text in the picture. For a time cut, make the second keyframe as an edit of the first (`input_references`) so the characters stay the same.
2. **Clips**: `minimax-h3` image-to-video, 768p, 9:16, `duration: 6`, `frame_images` first_frame = the keyframe. $0.48 per clip. Output is 768x1344, about 6.58 s, stereo 32 kHz. Prompt for motion and ambience only; the dialogue is dubbed.
3. **Voices**: `minimax-speech-2.8-hd` presets (for example `Wise_Woman`, `Casual_Guy`) with `language` set to the target language, `output_format {container: "mp3", sample_rate: 44100, bit_rate: 128000}`. The multilingual presets work for Spanish even though the voice list shows no Spanish presets.
4. **Mono everything**: `audio_detach` the clip ambience with `channels: "mono", sample_rate: 44100`. `timeline_create` rejects mixed mono/stereo or mixed sample rates.
5. **Audio spine**: one `timeline_audio` concat of ambience slices, TTS lines and the shared end card audio (Sume asset `asset_312ec728d3b147a6a1a0e84780ffd081`, mono, about 3.12 s). It returns segment offsets; use them for the sticker timings.
6. **Stickers**: upload each PNG (`media_upload`, PUT the bytes to the signed URL, `media_confirm`), then `timeline_compose` overlays it full frame (`position: center`, `width_ratio: 1`, `margin_ratio: 0`, output 1080x1920) on the matching clip slice.
7. **Assemble**: `timeline_create` with the audio spine and the video slots (sticker-composed clip slices, then `endcard.mp4`).
8. **Check**: `video_inspect` with frames and a transcript (`language_code`). Ship only if the transcript matches the script word for word, no sticker covers a face, no garbled text is visible, the hook is up by 0.5 s, the payoff holds at least 2.5 s, and the language facts are right.

### Network gotchas

- The cloud container and the Mac VM get 403 from `media.sume.com`. To use a generated keyframe in the end card, open it in Chrome and screenshot it, then crop and upscale.
- To put a final mp4 in Drive, fetch it inside a Chrome tab that has the Drive folder open and feed it to Drive's own upload input.
