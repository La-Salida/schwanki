// GENERATED from packages/mnemonic/src/adapters.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { Provider } from "./types.ts";

export class ProviderError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ProviderError"; }
}

export interface SentenceProvider { generateSentence(prompt: string): Promise<string> }
export interface ImageProvider { generateImage(prompt: string): Promise<Uint8Array> }
export interface TtsProvider { generateSpeech(text: string, language: string): Promise<Uint8Array> }

type FetchFn = typeof fetch;

/** Reasoning models can exhaust max_tokens before writing output, leaving content null
 *  (finish_reason "length"); surface that legibly instead of crashing downstream. */
function requireContent(
  data: { choices: Array<{ message: { content: string | null }, finish_reason?: string }> },
  what: string,
): string {
  const first = data.choices[0];
  const content = first?.message.content;
  if (content == null) {
    throw new Error(`${what}: model returned no content (finish_reason=${first?.finish_reason ?? "?"} — reasoning models burn tokens before answering; try again or pick a non-reasoning model)`);
  }
  return content;
}

async function check(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new ProviderError(res.status, `${what} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
}

export function createSentenceProvider(provider: Provider, apiKey: string, model = "", fetchFn: FetchFn = fetch): SentenceProvider {
  if (provider === "anthropic") return {
    async generateSentence(prompt) {
      const res = await check(await fetchFn("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: model || "claude-haiku-4-5", max_tokens: 300,
          messages: [{ role: "user", content: prompt }] }),
      }), "anthropic sentence");
      const data = await res.json() as { content: Array<{ type: string; text?: string }> };
      const text = data.content.find((b) => b.type === "text")?.text;
      if (!text) throw new Error("anthropic: no text block");
      return text;
    },
  };
  if (provider === "openai") return {
    async generateSentence(prompt) {
      const res = await check(await fetchFn("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || "gpt-4o-mini", max_tokens: 2000,
          messages: [{ role: "user", content: prompt }] }),
      }), "openai sentence");
      const data = await res.json() as { choices: Array<{ message: { content: string | null }, finish_reason?: string }> };
      return requireContent(data, "openai");
    },
  };
  if (provider === "openrouter") return {
    async generateSentence(prompt) {
      const res = await check(await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "X-Title": "Schwanki" },
        body: JSON.stringify({ model: model || "deepseek/deepseek-chat", max_tokens: 2000,
          messages: [{ role: "user", content: prompt }] }),
      }), "openrouter sentence");
      const data = await res.json() as { choices: Array<{ message: { content: string | null }, finish_reason?: string }> };
      return requireContent(data, "openrouter");
    },
  };
  throw new Error(`${provider} cannot generate sentences`);
}

export function createImageProvider(provider: Provider, apiKey: string, model = "", fetchFn: FetchFn = fetch): ImageProvider {
  if (provider === "fal") return {
    async generateImage(prompt) {
      const res = await check(await fetchFn(`https://fal.run/${model || "fal-ai/fast-sdxl"}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Key ${apiKey}` },
        body: JSON.stringify({ prompt, image_size: "square_hd", num_images: 1 }),
      }), "fal image");
      const data = await res.json() as { images: Array<{ url: string }> };
      const url = data.images[0]?.url;
      if (!url) throw new Error("fal: no image url");
      const img = await check(await fetchFn(url), "fal image download");
      return new Uint8Array(await img.arrayBuffer());
    },
  };
  if (provider === "together") return {
    async generateImage(prompt) {
      const res = await check(await fetchFn("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || "black-forest-labs/FLUX.1-schnell", prompt, width: 1024, height: 1024, n: 1 }),
      }), "together image");
      const data = await res.json() as { data: Array<{ url?: string; b64_json?: string }> };
      const first = data.data[0];
      if (first?.b64_json) return Uint8Array.from(atob(first.b64_json), (c) => c.charCodeAt(0));
      if (first?.url) {
        const img = await check(await fetchFn(first.url), "together image download");
        return new Uint8Array(await img.arrayBuffer());
      }
      throw new Error("together: no image data");
    },
  };
  if (provider === "openai") return {
    async generateImage(prompt) {
      const res = await check(await fetchFn("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
      }), "openai image");
      const data = await res.json() as { data: Array<{ b64_json?: string; url?: string }> };
      const first = data.data[0];
      if (first?.b64_json) return Uint8Array.from(atob(first.b64_json), (c) => c.charCodeAt(0));
      if (first?.url) {
        const img = await check(await fetchFn(first.url), "openai image download");
        return new Uint8Array(await img.arrayBuffer());
      }
      throw new Error("openai: no image data");
    },
  };
  if (provider === "higgsfield") return {
    // NOTE: verify the exact higgsfield image endpoint/payload against their current API
    // docs at implementation time; adjust URL/body if drifted. Shape mirrors fal.
    async generateImage(prompt) {
      const res = await check(await fetchFn("https://api.higgsfield.ai/v1/images/generations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
      }), "higgsfield image");
      const data = await res.json() as { images?: Array<{ url: string }>; url?: string };
      const url = data.images?.[0]?.url ?? data.url;
      if (!url) throw new Error("higgsfield: no image url");
      const img = await check(await fetchFn(url), "higgsfield image download");
      return new Uint8Array(await img.arrayBuffer());
    },
  };
  throw new Error(`${provider} cannot generate images`);
}

export function createTtsProvider(
  provider: Provider,
  apiKey: string,
  model = "",
  voice = "",
  fetchFn: FetchFn = fetch,
): TtsProvider {
  if (provider === "openai") return {
    async generateSpeech(text, _language) {
      const res = await check(await fetchFn("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || "tts-1", voice: voice || "nova", input: text }),
      }), "openai tts");
      return new Uint8Array(await res.arrayBuffer());
    },
  };
  if (provider === "fal") return {
    async generateSpeech(text, language) {
      const url = `https://fal.run/${model || "fal-ai/elevenlabs/tts/multilingual-v2"}`;
      // Premade ElevenLabs voices are all English-cloned; language-native voices come from
      // the voice library as IDs — `voice` lets the user pin one. language_code (ISO 639-1)
      // still enforces the right phonology for whatever voice is used.
      const opts = (lang?: string) => ({
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Key ${apiKey}` },
        body: JSON.stringify({
          text,
          voice: voice || "Aria",
          ...(lang ? { language_code: lang } : {}),
        }),
      });
      const lang = isoLanguage(language);
      let res = await fetchFn(url, opts(lang));
      if (!res.ok && lang) res = await fetchFn(url, opts());
      const checked = await check(res, "fal tts");
      const data = await checked.json() as { audio?: { url?: string }; audio_url?: string };
      const audioUrl = data.audio?.url ?? data.audio_url;
      if (!audioUrl) throw new Error("fal tts: no audio url");
      const audio = await check(await fetchFn(audioUrl), "fal tts download");
      return new Uint8Array(await audio.arrayBuffer());
    },
  };
  if (provider === "elevenlabs") return {
    async generateSpeech(text, _language) {
      // Direct API: voice_id in the path, xi-api-key auth, binary mp3 response.
      // language_code is NOT accepted on multilingual_v2 — the model auto-detects.
      // Default voice is the docs' example premade; pin a native one via `voice`.
      const voiceId = voice || "JBFqnCBsd6RMkjVDRZzb";
      const res = await check(await fetchFn(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "xi-api-key": apiKey },
          body: JSON.stringify({ text, model_id: model || "eleven_v4" }),
        },
      ), "elevenlabs tts");
      return new Uint8Array(await res.arrayBuffer());
    },
  };
  if (provider === "fish") return {
    async generateSpeech(text, _language) {
      // Fish Audio: model goes in the `model` request HEADER (not the body);
      // reference_id is the voice (their voice-model id); chunked mp3 response.
      const res = await check(await fetchFn("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          model: model || "s2.1-pro",
        },
        body: JSON.stringify({ text, format: "mp3", mp3_bitrate: 128, normalize: true, ...(voice ? { reference_id: voice } : {}) }),
      }), "fish tts");
      return new Uint8Array(await res.arrayBuffer());
    },
  };
  throw new Error(`${provider} cannot generate speech`);
}

/** "zh-TW" → "zh", "cmn-Hans" → undefined (not an ISO 639-1 primary the TTS knows). */
function isoLanguage(language: string): string | undefined {
  const primary = language.split("-")[0]?.toLowerCase() ?? "";
  return /^[a-z]{2}$/.test(primary) ? primary : undefined;
}
