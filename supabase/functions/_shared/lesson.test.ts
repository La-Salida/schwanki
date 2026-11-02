import { assertEquals } from "jsr:@std/assert";
import { checkParts, lessonCost, segmentWords, transcriptText } from "./lesson.ts";

Deno.test("an hour costs 12 credits, and the first lesson's first hour is free", () => {
  assertEquals(lessonCost(60 * 60_000, false), 12);
  assertEquals(lessonCost(61 * 60_000, false), 13);
  assertEquals(lessonCost(30_000, false), 1);
  assertEquals(lessonCost(50 * 60_000, true), 0);
  assertEquals(lessonCost(70 * 60_000, true), 2);
});

const part = { channel: "tab", part: 0, startMs: 0, durationMs: 1000, bytes: 10, checksum: "a".repeat(64), mimeType: "audio/webm;codecs=opus" };

Deno.test("checkParts accepts a normal upload and rejects broken ones", () => {
  assertEquals(checkParts([part, { ...part, channel: "microphone" }]), null);
  assertEquals(checkParts([]), "No audio parts were sent.");
  assertEquals(checkParts([part, part]), "Duplicate audio part.");
  assertEquals(checkParts([{ ...part, channel: "microphone" }]), "The lesson audio track is missing.");
  assertEquals(checkParts([{ ...part, checksum: "x" }]), "Bad part checksum.");
  assertEquals(checkParts([{ ...part, mimeType: "audio/mp4" }]), "Unsupported audio format.");
});

Deno.test("segmentWords splits on pauses and sentence ends and shifts by the part offset", () => {
  const words = [
    { text: "Hello", start: 0, end: 0.4, type: "word" }, { text: " ", type: "spacing" },
    { text: "there.", start: 0.5, end: 0.9, type: "word" }, { text: " ", type: "spacing" },
    { text: "(laughs)", start: 1, end: 1.2, type: "audio_event" },
    { text: "这个", start: 3, end: 3.4, type: "word" }, { text: "是", start: 3.4, end: 3.6, type: "word" },
  ];
  assertEquals(segmentWords(words, "tab", 600_000), [
    { channel: "tab", startMs: 600_000, endMs: 600_900, text: "Hello there." },
    { channel: "tab", startMs: 603_000, endMs: 603_600, text: "这个是" },
  ]);
});

Deno.test("transcriptText merges both tracks in time order with speaker labels", () => {
  const text = transcriptText([
    { channel: "microphone", startMs: 2000, endMs: 3000, text: "我觉得" },
    { channel: "tab", startMs: 1000, endMs: 1500, text: "你觉得呢？" },
    { channel: "tab", startMs: 3_725_000, endMs: 3_726_000, text: "再见" },
  ]);
  assertEquals(text, "[0:01] Tutor: 你觉得呢？\n[0:02] You: 我觉得\n[1:02:05] Tutor: 再见");
});
