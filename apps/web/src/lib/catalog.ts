import type { ModelOption, Provider } from "@schwanki/mnemonic";
import { supabase } from "./supabase";

export interface ProviderModelList { sentence?: ModelOption[]; image?: ModelOption[]; audio?: ModelOption[] }
export interface ModelCatalog {
  catalog: Partial<Record<Provider, ProviderModelList>>;
  failed: Partial<Record<Provider, string>>;
}

const EMPTY: ModelCatalog = { catalog: {}, failed: {} };
const TTL_MS = 5 * 60_000;
let cache: { at: number; value: ModelCatalog } | null = null;

/** Live model catalog from the list-models edge function (session-cached).
 *  On any failure → empty, so callers fall back to the curated registries. */
export async function loadModelCatalog(force = false): Promise<ModelCatalog> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { data, error } = await supabase.functions.invoke("list-models");
  const value: ModelCatalog = error || !data ? EMPTY : data as ModelCatalog;
  cache = { at: Date.now(), value };
  return value;
}
