import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createSentenceProvider, createImageProvider, ProviderError } from "./adapters.ts";

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
    const p = createImageProvider("fal", "fal-test", fetchFn);
    const bytes = await p.generateImage("a goose in a kitchen");
    expect(bytes[0]).toBe(137); // PNG magic
    expect(calls).toBe(2);
  });
});
