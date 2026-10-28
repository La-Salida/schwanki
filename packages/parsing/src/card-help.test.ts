import { describe, expect, it, vi } from "vitest";
import { suggestCardField } from "./card-help.ts";
import { createSuggestionHandler, type SuggestionDependencies } from "../../../supabase/functions/suggest-card-field/handler.ts";

const draft = { front: "行", back: "to be OK", reading: "", exampleSentence: "这样也行。" };
describe("AI field suggestions", () => {
  it("suggests a correction to a wrong definition without replacing the learner's field", async () => {
    const incorrect = { ...draft, front: "明显", back: "wrong meaning" };
    const value = await suggestCardField({ field: "back", draft: incorrect, language: "zh", context: "明显 obvious", guidance: "" }, {
      parseCards: async () => ({ cards: [{ front: "明显", back: "obvious" }] }),
    });
    expect(value).toBe("obvious");
    expect(incorrect.back).toBe("wrong meaning");
  });
  it("uses meaning and lesson context to disambiguate pinyin without changing the draft", async () => {
    const parseCards = vi.fn().mockResolvedValue({ cards: [{ front: "行", back: "to be OK", reading: "xíng" }] });
    const value = await suggestCardField({ field: "reading", draft, language: "zh", context: "这样也行。", guidance: "means OK here" }, { parseCards });
    expect(value).toBe("xíng");
    expect(draft.reading).toBe("");
    expect(parseCards.mock.calls[0]![0]).toContain("pinyin with tone marks");
    expect(parseCards.mock.calls[0]![0]).toContain("这样也行。");
  });
  it("refuses suggestions for another word or an indeterminate field", async () => {
    const input = { field: "reading" as const, draft, language: "zh", context: "", guidance: "" };
    await expect(suggestCardField(input, { parseCards: async () => ({ cards: [{ front: "好", reading: "hǎo" }] }) })).rejects.toThrow(/couldn't determine/);
    await expect(suggestCardField(input, { parseCards: async () => ({ cards: [{ front: "行", back: "OK" }] }) })).rejects.toThrow(/couldn't determine/);
  });
});

const id = "11111111-1111-4111-8111-111111111111";
const body = { id, kind: "candidate", field: "reading", draft, guidance: "" };
function allowance(ok: boolean) {
  return { ok, cost: 1, balance: ok ? 5 : 0, record: vi.fn().mockResolvedValue(undefined) };
}
function setup(patch: Partial<SuggestionDependencies> = {}) {
  const dependencies: SuggestionDependencies = {
    meter: vi.fn().mockResolvedValue(allowance(true)),
    authenticate: vi.fn().mockResolvedValue("u1"), loadOwned: vi.fn().mockResolvedValue({ language: "zh", context: "notes" }),
    available: () => true, suggest: vi.fn().mockResolvedValue("xíng"), ...patch,
  };
  const request = (payload = body, authenticated = true) => new Request("https://example.test/suggest-card-field", {
    method: "POST", headers: authenticated ? { authorization: "Bearer user-token" } : {}, body: JSON.stringify(payload),
  });
  return { dependencies, handler: createSuggestionHandler(dependencies), request };
}
describe("authenticated suggestion endpoint", () => {
  it("does not spend model calls on an anonymous request or someone else's card", async () => {
    const anonymous = setup();
    expect((await anonymous.handler(anonymous.request(body, false))).status).toBe(401);
    expect(anonymous.dependencies.suggest).not.toHaveBeenCalled();
    const foreign = setup({ loadOwned: vi.fn().mockResolvedValue(null) });
    expect((await foreign.handler(foreign.request())).status).toBe(404);
    expect(foreign.dependencies.suggest).not.toHaveBeenCalled();
  });
  it("returns a field suggestion only after ownership checks, without a save operation", async () => {
    const { handler, request, dependencies } = setup();
    const response = await handler(request());
    expect(await response.json()).toEqual({ field: "reading", value: "xíng" });
    expect(dependencies.loadOwned).toHaveBeenCalledWith({ id, kind: "candidate", userId: "u1", jwt: "user-token" });
  });
  it("reports configuration and provider failures instead of returning a successful blank", async () => {
    const unconfigured = setup({ available: () => false });
    expect((await unconfigured.handler(unconfigured.request())).status).toBe(503);
    const failed = setup({ suggest: async () => { throw new Error("provider unavailable"); } });
    expect((await failed.handler(failed.request())).status).toBe(502);
  });
  it("charges a credit for a suggestion, and refuses without one before calling AI", async () => {
    const paid = allowance(true);
    const ok = setup({ meter: vi.fn().mockResolvedValue(paid) });
    expect((await ok.handler(ok.request())).status).toBe(200);
    expect(paid.record).toHaveBeenCalledOnce();
    const broke = setup({ meter: vi.fn().mockResolvedValue(allowance(false)) });
    const refused = await broke.handler(broke.request());
    expect(refused.status).toBe(402);
    expect(((await refused.json()) as { code?: string }).code).toBe("no_credits");
    expect(broke.dependencies.suggest).not.toHaveBeenCalled();
    const failing = allowance(true);
    const failed = setup({ meter: vi.fn().mockResolvedValue(failing), suggest: async () => { throw new Error("down"); } });
    expect((await failed.handler(failed.request())).status).toBe(502);
    expect(failing.record).not.toHaveBeenCalled();
  });
  it("rejects unsupported fields before loading a record or calling AI", async () => {
    const { handler, request, dependencies } = setup();
    expect((await handler(request({ ...body, field: "front" }))).status).toBe(400);
    expect(dependencies.loadOwned).not.toHaveBeenCalled();
  });
});
