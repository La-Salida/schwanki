import { beforeEach, expect, it, vi } from "vitest";

const { init, track, setUserId } = vi.hoisted(() => ({ init: vi.fn(), track: vi.fn(), setUserId: vi.fn() }));
vi.mock("@amplitude/analytics-browser", () => ({ init, track, setUserId, reset: vi.fn(), identify: vi.fn(), Identify: class { setOnce() { return this; } } }));

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

it("stays off outside the production site", async () => {
  const analytics = await import("./analytics");
  expect(analytics.startAnalytics("schwanki-staging.yj-3e3.workers.dev", true)).toBe(false);
  expect(analytics.startAnalytics("schwankiapp.com", false)).toBe(false);
  analytics.track({ name: "Account Created" });
  expect(init).not.toHaveBeenCalled();
  expect(track).not.toHaveBeenCalled();
});

it("starts once on schwankiapp.com without capturing clicks or form contents", async () => {
  const analytics = await import("./analytics");
  expect(analytics.startAnalytics("schwankiapp.com", true)).toBe(true);
  analytics.startAnalytics("schwankiapp.com", true);
  expect(init).toHaveBeenCalledTimes(1);
  const options = init.mock.calls[0]![1];
  expect(options.autocapture).toMatchObject({ attribution: true, elementInteractions: false, formInteractions: false });
  analytics.identifyAnalyticsUser("user-1");
  analytics.track({ name: "Card Reviewed", props: { rating: "good", is_new: true } });
  expect(setUserId).toHaveBeenCalledWith("user-1");
  expect(track).toHaveBeenCalledWith("Card Reviewed", { rating: "good", is_new: true });
});
