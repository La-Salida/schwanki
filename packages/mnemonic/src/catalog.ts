import type { MediaKind } from "@schwanki/core";
import type { ModelOption } from "./models.ts";
import type { Provider } from "./types.ts";

export interface ProviderModelList { sentence?: ModelOption[]; image?: ModelOption[]; audio?: ModelOption[] }
export type LiveCatalog = Partial<Record<Provider, ProviderModelList>>;

/** Listing endpoints per provider (shapes verified 2026-10). Providers without an
 *  endpoint (fish, fal, higgsfield) are curated-fallback only — by design, not drift. */
export const MODEL_LIST_ENDPOINT: Partial<
  Record<Provider, { url: string; headers: (apiKey: string) => Record<string, string> }>
> = {
  openrouter: { url: "https://openrouter.ai/api/v1/models", headers: () => ({}) }, // public listing
  elevenlabs: { url: "https://api.elevenlabs.io/v1/models", headers: (k) => ({ "xi-api-key": k }) },
  openai: { url: "https://api.openai.com/v1/models", headers: (k) => ({ authorization: `Bearer ${k}` }) },
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    headers: (k) => ({ "x-api-key": k, "anthropic-version": "2023-06-01" }),
  },
  together: { url: "https://api.together.xyz/v1/models", headers: (k) => ({ authorization: `Bearer ${k}` }) },
};

const push = (
  out: ProviderModelList,
  provider: Provider,
  kind: MediaKind,
  id: unknown,
  label: unknown,
  pricing?: string,
  pricingPerM?: { in: number; out: number },
) => {
  if (typeof id !== "string" || !id.trim()) return;
  (out[kind] ??= []).push({
    id: id.trim(),
    label: typeof label === "string" && label.trim() ? label.trim() : id.trim(),
    provider,
    ...(pricing ? { pricing } : {}),
    ...(pricingPerM ? { pricingPerM } : {}),
  });
};

const usd = (n: number): string => (n >= 0.01 ? n.toFixed(2) : String(n));

/** OpenRouter lists USD per 1M tokens as strings; zero-zero means a :free-tier model. */
function openrouterCost(m: unknown): { text?: string; perM?: { in: number; out: number } } {
  const pricing = (m as { pricing?: { prompt?: unknown; completion?: unknown } }).pricing;
  if (!pricing || typeof pricing.prompt !== "string" || typeof pricing.completion !== "string") return {};
  const p = Number(pricing.prompt);
  const c = Number(pricing.completion);
  if (Number.isNaN(p) || Number.isNaN(c)) return {};
  if (p === 0 && c === 0) return { text: "$0 (provider free tier)" };
  return { text: `$${usd(p)}/M in · $${usd(c)}/M out`, perM: { in: p, out: c } };
}

/** ElevenLabs lists credit multipliers, not absolute $ (those depend on the plan tier). */
function elevenlabsCost(m: unknown): string | undefined {
  const rates = (m as { model_rates?: { character_cost_multiplier?: unknown; cost_discount_multiplier?: unknown } }).model_rates;
  if (!rates) return undefined;
  const mult = typeof rates.character_cost_multiplier === "number" ? rates.character_cost_multiplier : 1;
  const disc = typeof rates.cost_discount_multiplier === "number" ? rates.cost_discount_multiplier : 1;
  const effective = mult * disc;
  if (!Number.isFinite(effective) || effective === 1) return undefined;
  return `×${effective.toFixed(2)} credits/char`;
}

const asArray = (json: unknown): unknown[] => {
  if (Array.isArray(json)) return json; // Together returns a bare array
  const data = (json as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? data : [];
};

/** Defensive per-provider classification of a listing response into modalities.
 *  Unknown shapes / garbage → {} — never throws; the curated registry is the fallback. */
export function parseModelList(provider: Provider, json: unknown): ProviderModelList {
  const out: ProviderModelList = {};
  if (!json || typeof json !== "object") return out;
  try {
    if (provider === "openrouter") {
      for (const m of asArray(json)) {
        const e = m as { id?: unknown; name?: unknown; architecture?: { output_modalities?: unknown } };
        if (typeof e.id !== "string" || e.id.startsWith("~")) continue; // ~-prefixed alias redirects
        const outputs = Array.isArray(e.architecture?.output_modalities)
          ? e.architecture.output_modalities as string[]
          : [];
        const cost = openrouterCost(m);
        if (outputs.includes("image")) push(out, provider, "image", e.id, e.name, cost.text, cost.perM);
        else if (outputs.includes("text")) push(out, provider, "sentence", e.id, e.name, cost.text, cost.perM);
      }
      return out;
    }
    if (provider === "elevenlabs") {
      for (const m of asArray(json)) {
        const e = m as { model_id?: unknown; name?: unknown; can_do_text_to_speech?: unknown };
        if (e.can_do_text_to_speech !== true) continue;
        push(out, provider, "audio", e.model_id, e.name, elevenlabsCost(m));
      }
      return out;
    }
    // OpenAI-standard { data: [{ id, display_name? }] } — openai / anthropic / together
    for (const m of asArray(json)) {
      const e = m as { id?: unknown; display_name?: unknown; name?: unknown };
      const id = typeof e.id === "string" ? e.id : "";
      if (!id) continue;
      const label = e.display_name ?? e.name ?? id;
      const l = id.toLowerCase();
      if (provider === "anthropic") {
        push(out, provider, "sentence", id, label);
      } else if (provider === "together") {
        if (/flux|sdxl|stable|imagen/.test(l)) push(out, provider, "image", id, label);
        else push(out, provider, "sentence", id, label);
      } else if (provider === "openai") {
        if (/^gpt-image|^dall-e/.test(l)) push(out, provider, "image", id, label);
        else if (/tts/.test(l)) push(out, provider, "audio", id, label);
        else if (/^(gpt-|o[34]|chatgpt)/.test(l)) push(out, provider, "sentence", id, label);
      }
    }
    return out;
  } catch {
    return out;
  }
}

export const MODEL_LIST_CAP = 60;

/** Curated entries first (known-good labels), live entries deduped by id, capped. */
export function mergeCatalog(curated: ModelOption[], live: ModelOption[] = [], cap = MODEL_LIST_CAP): ModelOption[] {
  const seen = new Set<string>();
  const out: ModelOption[] = [];
  for (const m of [...curated, ...live]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
    if (out.length >= cap) break;
  }
  return out;
}
