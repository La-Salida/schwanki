import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const { invoke, loadCardMedia } = vi.hoisted(() => ({ invoke: vi.fn(), loadCardMedia: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/lib/mnemonic", () => ({ loadCardMedia }));
import { CardEditor } from "./CardEditor";
const initial = { front: "明显", back: "wrong meaning", reading: "", exampleSentence: "" };
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
function show(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(<CardEditor id="c1" kind="candidate" initial={initial} onSave={onSave} onCancel={vi.fn()} />);
  return onSave;
}
describe("manual and AI-assisted correction", () => {
  it("edits the generated sentence and translation and stages media changes until save", async () => {
    loadCardMedia.mockResolvedValue({ sentence: { text: "旧句子。", translation: "Old." }, imageUrl: "/old.png", audioUrl: "/old.mp3" });
    const save = vi.fn().mockResolvedValue(undefined);
    render(<CardEditor id="c1" kind="card" initial={initial} onSave={save} onCancel={vi.fn()} />);
    const sentence = await screen.findByLabelText("Review sentence");
    fireEvent.change(sentence, { target: { value: "猫有腹肌。" } });
    fireEvent.change(screen.getByLabelText("Sentence translation"), { target: { value: "The cat has abs." } });
    const image = new File(["pixels"], "cat.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Replace image"), { target: { files: [image] } });
    fireEvent.click(screen.getByRole("button", { name: "Remove recording" }));
    expect(save).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(initial, {
      example: { text: "猫有腹肌。", translation: "The cat has abs." }, image, audio: null,
    }));
  });
  it("saves manual definitions and pinyin without calling AI", async () => {
    const save = show();
    fireEvent.change(screen.getByLabelText("English meaning"), { target: { value: " obvious " } });
    fireEvent.change(screen.getByLabelText("Pinyin / pronunciation"), { target: { value: "míngxiǎn" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ ...initial, back: "obvious", reading: "míngxiǎn" }));
    expect(invoke).not.toHaveBeenCalled();
  });
  it("requires accepting a suggestion and then saving it, leaving other fields alone", async () => {
    invoke.mockResolvedValue({ data: { field: "reading", value: "míngxiǎn" }, error: null });
    const save = show();
    fireEvent.click(screen.getByRole("button", { name: /suggest pronunciation/i }));
    expect(await screen.findByText("míngxiǎn")).toBeTruthy();
    expect((screen.getByLabelText("Pinyin / pronunciation") as HTMLInputElement).value).toBe("");
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /use suggestion/i }));
    expect((screen.getByLabelText("English meaning") as HTMLInputElement).value).toBe(initial.back);
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ ...initial, reading: "míngxiǎn" }));
  });
  it("discards a late suggestion if the learner changes the word during the request", async () => {
    let finish!: (value: unknown) => void;
    invoke.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    show();
    fireEvent.click(screen.getByRole("button", { name: /suggest pronunciation/i }));
    fireEvent.change(screen.getByLabelText("Word or phrase"), { target: { value: "安排" } });
    await act(async () => { finish({ data: { field: "reading", value: "míngxiǎn" }, error: null }); });
    expect(screen.queryByText("míngxiǎn")).toBeNull();
    expect((screen.getByLabelText("Word or phrase") as HTMLInputElement).value).toBe("安排");
  });
  it("keeps manual editing available when AI fails or a save fails", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("unavailable") });
    const save = show(vi.fn().mockRejectedValue(new Error("save failed")));
    fireEvent.click(screen.getByRole("button", { name: /suggest meaning/i }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("edit manually"));
    fireEvent.change(screen.getByLabelText("English meaning"), { target: { value: "obvious" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("save failed")).toBeTruthy();
    expect((screen.getByLabelText("English meaning") as HTMLInputElement).value).toBe("obvious");
    expect(save).toHaveBeenCalledOnce();
  });
});
