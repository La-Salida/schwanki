import { afterEach, expect, it, vi } from "vitest";
import { createDeepSeekProvider, createOpenRouterParsingProvider } from "./openai-compatible.ts";

afterEach(() => vi.unstubAllGlobals());
it("DeepSeek parsing requests JSON and returns the extracted cards", async () => {
  const cards = { cards: [{ front: "明显", back: "obvious", reading: "míng xiǎn" }] };
  const fetch = vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(cards) } }] }));
  vi.stubGlobal("fetch", fetch);
  expect(await createDeepSeekProvider("fixture-key").parseCards("class notes")).toEqual(cards);
  const [url, request] = fetch.mock.calls[0]!;
  expect(url).toBe("https://api.deepseek.com/chat/completions");
  const body = JSON.parse(request.body);
  expect(body.model).toBe("deepseek-v4-flash");
  expect(body.response_format).toEqual({ type: "json_object" });
  expect(body.messages[1].content).toBe("class notes");
});
it("OpenRouter can provide the same parsing interface", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"cards":[]}' } }] }));
  vi.stubGlobal("fetch", fetch);
  expect(await createOpenRouterParsingProvider("fixture-key").parseCards("notes")).toEqual({ cards: [] });
  expect(fetch.mock.calls[0]![0]).toBe("https://openrouter.ai/api/v1/chat/completions");
});
it.each([
  [{ choices: [{ finish_reason: "length", message: { content: '{"cards":[]}' } }] }, /truncated/],
  [{ choices: [{ message: { content: "not JSON" } }] }, /invalid JSON/],
  [{ choices: [] }, /no vocabulary JSON/],
])("rejects incomplete or unusable provider responses", async (body, error) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
  await expect(createDeepSeekProvider("fixture-key").parseCards("notes")).rejects.toThrow(error);
});
it("provider failures never include credentials or raw upstream bodies", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fixture-key upstream body", { status: 401 })));
  await expect(createDeepSeekProvider("fixture-key").parseCards("notes")).rejects.toThrow("Parsing provider returned HTTP 401.");
});
