import { afterEach, expect, it, vi } from "vitest";
import { playSfx } from "./sfx";

class FakeNode { connect() { return this; } start() {} stop() {} frequency = { setValueAtTime: vi.fn() }; gain = { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }; type = "sine" }
class FakeContext {
  state = "running"; currentTime = 0; destination = {};
  created = 0;
  createOscillator() { this.created++; return new FakeNode(); }
  createGain() { return new FakeNode(); }
  resume() { return Promise.resolve(); }
}
afterEach(() => vi.unstubAllGlobals());

it("plays through Web Audio when not muted, and stays silent when muted or under reduced motion", () => {
  const contexts: FakeContext[] = [];
  vi.stubGlobal("AudioContext", class extends FakeContext { constructor() { super(); contexts.push(this); } });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  playSfx("knew", true);
  expect(contexts).toHaveLength(0);
  playSfx("knew", false);
  expect(contexts[0]!.created).toBe(2);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  playSfx("finish", false);
  expect(contexts[0]!.created).toBe(2);
});

it("never throws without Web Audio", () => {
  vi.stubGlobal("AudioContext", undefined);
  expect(() => playSfx("forgot", false)).not.toThrow();
});
