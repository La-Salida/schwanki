import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createSentenceProvider, createImageProvider, createTtsProvider, ProviderError } from "./adapters.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), "utf8"));
const fxFetch = (body: unknown, status = 200) =>
  (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

/** Captures the request init handed to fetch and replies with `body`. */
const captureFetch = (body: unknown, status = 200) => {
  let captured: RequestInit | undefined;
  const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
    captured = init;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchFn, init: () => captured };
};

describe("anthropic sentence adapter", () => {
  it("extracts the text block", async () => {
    const p = createSentenceProvider("anthropic", "sk-ant-test", "", fxFetch(fixture("anthropic-sentence.json")));
    const text = await p.generateSentence("prompt");
    expect(text).toContain("SENTENCE:");
  });
  it("throws ProviderError with status on 401", async () => {
    const p = createSentenceProvider("anthropic", "bad-key", "", fxFetch({ error: { message: "invalid" } }, 401));
    await expect(p.generateSentence("x")).rejects.toMatchObject({ status: 401 });
    await expect(p.generateSentence("x")).rejects.toBeInstanceOf(ProviderError);
  });
  it("passes the model through and defaults to haiku when empty", async () => {
    const picked = captureFetch(fixture("anthropic-sentence.json"));
    const withModel = createSentenceProvider("anthropic", "sk-ant-test", "claude-sonnet-4-5", picked.fetchFn);
    await withModel.generateSentence("prompt");
    expect(JSON.parse(String(picked.init()!.body)).model).toBe("claude-sonnet-4-5");

    const blank = captureFetch(fixture("anthropic-sentence.json"));
    const noModel = createSentenceProvider("anthropic", "sk-ant-test", "", blank.fetchFn);
    await noModel.generateSentence("prompt");
    expect(JSON.parse(String(blank.init()!.body)).model).toBe("claude-haiku-4-5");
  });
});

describe("openrouter sentence adapter", () => {
  it("extracts choices[0].message.content and defaults the model", async () => {
    const captured = captureFetch(fixture("openrouter-sentence.json"));
    const p = createSentenceProvider("openrouter", "sk-or-test", "", captured.fetchFn);
    const text = await p.generateSentence("prompt");
    expect(text).toContain("SENTENCE:");
    expect(text).toContain("TRANSLATION:");
    const init = captured.init()!;
    expect(JSON.parse(String(init.body)).model).toBe("deepseek/deepseek-chat");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-or-test");
    expect(headers.get("x-title")).toBe("Schwanki");
  });
  it("throws ProviderError with status on 401", async () => {
    const p = createSentenceProvider("openrouter", "bad-key", "", fxFetch({ error: { message: "invalid" } }, 401));
    await expect(p.generateSentence("x")).rejects.toMatchObject({ status: 401 });
    await expect(p.generateSentence("x")).rejects.toBeInstanceOf(ProviderError);
  });
  it("explains null content (reasoning model exhausted the token budget) instead of crashing", async () => {
    const p = createSentenceProvider("openrouter", "sk-or-test", "deepseek/deepseek-r1", fxFetch(fixture("openrouter-null-content.json")));
    await expect(p.generateSentence("x")).rejects.toThrow(/no content.*finish_reason=length/s);
  });
  it("gives reasoning models enough tokens to answer (max_tokens 2000)", async () => {
    const captured = captureFetch(fixture("openrouter-sentence.json"));
    const p = createSentenceProvider("openrouter", "sk-or-test", "", captured.fetchFn);
    await p.generateSentence("prompt");
    expect(JSON.parse(String(captured.init()!.body)).max_tokens).toBe(2000);
  });
});

describe("fal image adapter", () => {
  it("returns image bytes from the result URL", async () => {
    const payload = fixture("fal-image.json");
    let calls = 0;
    const fetchFn = (async (url: string | URL | Request) => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify(payload), { status: 200 }); // submit
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });        // image bytes
    }) as typeof fetch;
    const p = createImageProvider("fal", "fal-test", "", fetchFn);
    const bytes = await p.generateImage("a goose in a kitchen");
    expect(bytes[0]).toBe(137); // PNG magic
    expect(calls).toBe(2);
  });
  it("puts the model in the URL path", async () => {
    let calls = 0;
    const urls: string[] = [];
    const fetchFn = (async (url: string | URL | Request) => {
      urls.push(String(url));
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ images: [{ url: "https://cdn.example.com/i.png" }] }), { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;
    const p = createImageProvider("fal", "fal-test", "fal-ai/flux/schnell", fetchFn);
    await p.generateImage("a goose in a kitchen");
    expect(urls[0]).toContain("/fal-ai/flux/schnell");
  });
  it("defaults the model when empty", async () => {
    let calls = 0;
    const urls: string[] = [];
    const fetchFn = (async (url: string | URL | Request) => {
      urls.push(String(url));
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ images: [{ url: "https://cdn.example.com/i.png" }] }), { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;
    const p = createImageProvider("fal", "fal-test", "", fetchFn);
    await p.generateImage("a goose in a kitchen");
    expect(urls[0]).toBe("https://fal.run/fal-ai/fast-sdxl");
  });
});

describe("together image adapter", () => {
  it("defaults the model to FLUX.1-schnell and passes explicit models through", async () => {
    const dflt = captureFetch({ data: [{ b64_json: "AAAA" }] });
    await createImageProvider("together", "tg-test", "", dflt.fetchFn).generateImage("p");
    expect(JSON.parse(String(dflt.init()!.body)).model).toBe("black-forest-labs/FLUX.1-schnell");

    const explicit = captureFetch({ data: [{ b64_json: "AAAA" }] });
    await createImageProvider("together", "tg-test", "black-forest-labs/FLUX.1-dev", explicit.fetchFn).generateImage("p");
    expect(JSON.parse(String(explicit.init()!.body)).model).toBe("black-forest-labs/FLUX.1-dev");
  });
});

describe("openai image adapter", () => {
  it("defaults the model to gpt-image-1", async () => {
    const c = captureFetch({ data: [{ b64_json: "AAAA" }] });
    await createImageProvider("openai", "sk-test", "", c.fetchFn).generateImage("p");
    expect(JSON.parse(String(c.init()!.body)).model).toBe("gpt-image-1");
  });
});

describe("higgsfield image adapter", () => {
  it("ignores the model param entirely", async () => {
    let calls = 0;
    let captured: RequestInit | undefined;
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls++;
      if (init) captured = init; // second (download) call has no init
      if (calls === 1) return new Response(JSON.stringify({ images: [{ url: "https://cdn.example.com/i.png" }] }), { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;
    await createImageProvider("higgsfield", "hf-test", "whatever/model", fetchFn).generateImage("p");
    expect(JSON.parse(String(captured!.body))).not.toHaveProperty("model");
  });
});

describe("openai tts adapter", () => {
  it("defaults the model to tts-1 and passes explicit models through", async () => {
    const dflt = captureFetch(new Uint8Array([1, 2, 3]));
    await createTtsProvider("openai", "sk-test", "", "", dflt.fetchFn).generateSpeech("hi", "en");
    expect(JSON.parse(String(dflt.init()!.body)).model).toBe("tts-1");

    const explicit = captureFetch(new Uint8Array([1, 2, 3]));
    await createTtsProvider("openai", "sk-test", "tts-1-hd", "", explicit.fetchFn).generateSpeech("hi", "en");
    expect(JSON.parse(String(explicit.init()!.body)).model).toBe("tts-1-hd");
  });
  it("defaults the voice to nova and passes a chosen voice through", async () => {
    const dflt = captureFetch(new Uint8Array([1]));
    await createTtsProvider("openai", "sk-test", "", "", dflt.fetchFn).generateSpeech("hi", "en");
    expect(JSON.parse(String(dflt.init()!.body)).voice).toBe("nova");

    const custom = captureFetch(new Uint8Array([1]));
    await createTtsProvider("openai", "sk-test", "", "shimmer", custom.fetchFn).generateSpeech("hi", "en");
    expect(JSON.parse(String(custom.init()!.body)).voice).toBe("shimmer");
  });
});

describe("fal tts adapter", () => {
  it("puts the model in the URL path", async () => {
    let calls = 0;
    const urls: string[] = [];
    const fetchFn = (async (url: string | URL | Request) => {
      urls.push(String(url));
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ audio: { url: "https://cdn.example.com/a.mp3" } }), { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;
    const p = createTtsProvider("fal", "fal-test", "fal-ai/elevenlabs/tts/multilingual-v2", "", fetchFn);
    await p.generateSpeech("hi", "en");
    expect(urls[0]).toContain("fal-ai/elevenlabs/tts/multilingual-v2");
  });
  it("defaults the model when empty", async () => {
    let calls = 0;
    const urls: string[] = [];
    const fetchFn = (async (url: string | URL | Request) => {
      urls.push(String(url));
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ audio: { url: "https://cdn.example.com/a.mp3" } }), { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;
    const p = createTtsProvider("fal", "fal-test", "", "", fetchFn);
    await p.generateSpeech("hi", "en");
    expect(urls[0]).toBe("https://fal.run/fal-ai/elevenlabs/tts/multilingual-v2");
  });
  it("sends language_code for the target language (zh → Mandarin phonology)", async () => {
    let calls = 0;
    const bodies: string[] = [];
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls++;
      bodies.push(String(init?.body));
      if (calls === 1) return new Response(JSON.stringify({ audio: { url: "https://cdn.example.com/a.mp3" } }), { status: 200 });
      return new Response(new Uint8Array([1]), { status: 200 });
    }) as typeof fetch;
    const p = createTtsProvider("fal", "fal-test", "", "", fetchFn);
    await p.generateSpeech("我的猫制订了计划。", "zh-TW");
    expect(JSON.parse(bodies[0]!).language_code).toBe("zh");
    expect(calls).toBe(2); // no retry — first call succeeded
  });
  it("uses the chosen voice (voice-library ID for native languages) instead of Aria", async () => {
    let calls = 0;
    const bodies: string[] = [];
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls++;
      bodies.push(String(init?.body));
      if (calls === 1) return new Response(JSON.stringify({ audio: { url: "https://cdn.example.com/a.mp3" } }), { status: 200 });
      return new Response(new Uint8Array([1]), { status: 200 });
    }) as typeof fetch;
    const p = createTtsProvider("fal", "fal-test", "", "nativeZhVoice123", fetchFn);
    await p.generateSpeech("我的猫制订了计划。", "zh");
    expect(JSON.parse(bodies[0]!).voice).toBe("nativeZhVoice123");
    expect(JSON.parse(bodies[0]!).language_code).toBe("zh");
  });
  it("retries without language_code when the language is unsupported", async () => {
    let calls = 0;
    const bodies: string[] = [];
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls++;
      bodies.push(String(init?.body));
      if (calls === 1) return new Response(JSON.stringify({ detail: "language code not supported" }), { status: 400 });
      if (calls === 2) return new Response(JSON.stringify({ audio: { url: "https://cdn.example.com/a.mp3" } }), { status: 200 });
      return new Response(new Uint8Array([1]), { status: 200 });
    }) as typeof fetch;
    const p = createTtsProvider("fal", "fal-test", "", "", fetchFn);
    const bytes = await p.generateSpeech("hello", "xx");
    expect(bytes.length).toBe(1);
    expect(JSON.parse(bodies[0]!).language_code).toBe("xx");
    expect(JSON.parse(bodies[1]!).language_code).toBeUndefined();
    expect(calls).toBe(3); // hinted 400 → un-hinted 200 → download
  });
});

/** Captures url + init and returns BINARY audio bytes (unlike captureFetch, which JSON-stringifies). */
const binaryFetch = (bytes: Uint8Array, status = 200) => {
  let url = "";
  let init: RequestInit | undefined;
  const fetchFn = (async (u: string | URL | Request, i?: RequestInit) => {
    url = String(u);
    init = i;
    return new Response(new Uint8Array(bytes), { status });
  }) as unknown as typeof fetch;
  return { fetchFn, url: () => url, init: () => init };
};

describe("elevenlabs tts adapter (direct API)", () => {
  it("puts voice_id in the path, xi-api-key in headers, model_id in body; returns binary", async () => {
    const captured = binaryFetch(new Uint8Array([1, 2, 3]));
    const p = createTtsProvider("elevenlabs", "eleven-key", "eleven_turbo_v2_5", "nativeZhVoice123", captured.fetchFn);
    const bytes = await p.generateSpeech("我的猫制订了计划。", "zh");
    expect([...bytes]).toEqual([1, 2, 3]);
    const headers = new Headers(captured.init()!.headers);
    expect(headers.get("xi-api-key")).toBe("eleven-key");
    expect(JSON.parse(String(captured.init()!.body)).model_id).toBe("eleven_turbo_v2_5");
    expect(captured.url()).toContain("/v1/text-to-speech/nativeZhVoice123");
  });
  it("defaults voice and model when unset", async () => {
    const captured = binaryFetch(new Uint8Array([1]));
    const p = createTtsProvider("elevenlabs", "eleven-key", "", "", captured.fetchFn);
    await p.generateSpeech("hi", "en");
    expect(JSON.parse(String(captured.init()!.body)).model_id).toBe("eleven_multilingual_v2");
    expect(captured.url()).toContain("/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb");
  });
  it("throws ProviderError with status on 401", async () => {
    const p = createTtsProvider("elevenlabs", "bad", "", "", fxFetch({ detail: "invalid" }, 401));
    await expect(p.generateSpeech("hi", "en")).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("fish tts adapter (direct API)", () => {
  it("selects the model via the model HEADER and sends reference_id only when a voice is set", async () => {
    const withVoice = binaryFetch(new Uint8Array([9, 9]));
    const p1 = createTtsProvider("fish", "fish-key", "s1", "fishVoiceRef99", withVoice.fetchFn);
    const b1 = await p1.generateSpeech("你好", "zh");
    expect([...b1]).toEqual([9, 9]);
    const headers1 = new Headers(withVoice.init()!.headers);
    expect(headers1.get("authorization")).toBe("Bearer fish-key");
    expect(headers1.get("model")).toBe("s1");
    const body1 = JSON.parse(String(withVoice.init()!.body));
    expect(body1.reference_id).toBe("fishVoiceRef99");
    expect(body1.format).toBe("mp3");
    expect(body1.normalize).toBe(true);

    const noVoice = binaryFetch(new Uint8Array([9, 9]));
    const p2 = createTtsProvider("fish", "fish-key", "", "", noVoice.fetchFn);
    await p2.generateSpeech("你好", "zh");
    expect(new Headers(noVoice.init()!.headers).get("model")).toBe("s2.1-pro");
    expect(JSON.parse(String(noVoice.init()!.body)).reference_id).toBeUndefined();
  });
});
