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

export function createTtsProvider(provider: Provider, apiKey: string, model = "", fetchFn: FetchFn = fetch): TtsProvider {
  if (provider === "openai") return {
    async generateSpeech(text, _language) {
      const res = await check(await fetchFn("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || "tts-1", voice: "nova", input: text }),
      }), "openai tts");
      return new Uint8Array(await res.arrayBuffer());
    },
  };
  if (provider === "fal") return {
    async generateSpeech(text, language) {
      const url = `https://fal.run/${model || "fal-ai/elevenlabs/tts/multilingual-v2"}`;
      const opts = (lang?: string) => ({
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Key ${apiKey}` },
        // language_code (ISO 639-1) enforces the right phonology — without it ElevenLabs
        // voices read Mandarin (etc.) with an English bias. Unsupported codes are
        // rejected, so fall back to an un-hinted retry on error.
        body: JSON.stringify(lang ? { text, voice: "Aria", language_code: lang } : { text, voice: "Aria" }),
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
  throw new Error(`${provider} cannot generate speech`);
}

/** "zh-TW" → "zh", "cmn-Hans" → undefined (not an ISO 639-1 primary the TTS knows). */
function isoLanguage(language: string): string | undefined {
  const primary = language.split("-")[0]?.toLowerCase() ?? "";
  return /^[a-z]{2}$/.test(primary) ? primary : undefined;
}
