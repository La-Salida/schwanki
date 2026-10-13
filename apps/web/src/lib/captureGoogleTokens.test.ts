import { describe, it, expect, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./supabase", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    auth: {
      getSession: () => Promise.resolve({
        data: { session: { provider_refresh_token: "fresh-token", user: { id: "u1" } } },
      }),
    },
  },
}));

import { captureGoogleTokens } from "./auth";

describe("captureGoogleTokens", () => {
  it("saves a new sign-in's refresh token through the definer RPC", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await captureGoogleTokens()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("store_google_refresh_token", { token: "fresh-token" });
  });

  it("reports failure when the RPC errors", async () => {
    rpc.mockResolvedValue({ error: { message: "boom" } });
    expect(await captureGoogleTokens()).toBe(false);
  });
});
