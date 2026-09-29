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
    await createTtsProvider("openai", "sk-test", "", dflt.fetchFn).generateSpeech("hi", "en");
    expect(JSON.parse(String(dflt.init()!.body)).model).toBe("tts-1");

    const explicit = captureFetch(new Uint8Array([1, 2, 3]));
    await createTtsProvider("openai", "sk-test", "tts-1-hd", explicit.fetchFn).generateSpeech("hi", "en");
    expect(JSON.parse(String(explicit.init()!.body)).model).toBe("tts-1-hd");
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
    const p = createTtsProvider("fal", "fal-test", "fal-ai/elevenlabs/tts/multilingual-v2", fetchFn);
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
    const p = createTtsProvider("fal", "fal-test", "", fetchFn);
    await p.generateSpeech("hi", "en");
    expect(urls[0]).toBe("https://fal.run/fal-ai/elevenlabs/tts/multilingual-v2");
  });
});
