import type { LlmProvider } from "./types";

const CARDS_TOOL = {
  name: "emit_cards",
  description: "Emit extracted vocabulary cards",
  input_schema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            front: { type: "string" },
            back: { type: "string" },
            reading: { type: "string" },
            example: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["front", "back"],
        },
      },
    },
    required: ["cards"],
  },
};

/** Raw-fetch Anthropic provider — zero deps, runs in Node 18+ and Deno alike. */
export function createAnthropicProvider(apiKey: string, model = "claude-haiku-4-5"): LlmProvider {
  return {
    async parseCards(prompt: string): Promise<unknown> {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0,
          tools: [CARDS_TOOL],
          tool_choice: { type: "tool", name: "emit_cards" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { content: Array<{ type: string; input?: unknown }> };
      const toolUse = body.content.find((b) => b.type === "tool_use");
      if (!toolUse) throw new Error("no tool_use block in response");
      return toolUse.input;
    },
  };
}
