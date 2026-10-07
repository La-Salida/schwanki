import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

afterEach(cleanup);

const addSource = vi.fn();
const uploadSourcePdf = vi.fn();
vi.mock("@/lib/supabase", () => ({
  api: { addSource: (...a: unknown[]) => addSource(...a), uploadSourcePdf: (...a: unknown[]) => uploadSourcePdf(...a) },
  supabase: { functions: { invoke: vi.fn() } },
}));

import { SourceForm } from "./SourceForm";

const sheetUrl = "https://docs.google.com/spreadsheets/d/1NvH/edit";
const canvaUrl = "https://www.canva.com/design/DAF123abc/view";
const pdfFile = () => new File(["%PDF-1.4"], "lesson.pdf", { type: "application/pdf" });

beforeEach(() => {
  addSource.mockReset();
  uploadSourcePdf.mockReset();
  addSource.mockResolvedValue({ id: "s1", type: "pdf_upload" });
});

describe("SourceForm", () => {
  it("google mode: submits a detected sheet link", async () => {
    const onAdded = vi.fn();
    render(<SourceForm onAdded={onAdded} />);
    fireEvent.change(screen.getByPlaceholderText(/google doc or sheet link/i), { target: { value: sheetUrl } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "google_sheet", externalRef: sheetUrl }),
    ));
    expect(uploadSourcePdf).not.toHaveBeenCalled();
    expect(onAdded).toHaveBeenCalled();
  });

  it("google mode: rejects non-google links", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/google doc or sheet link/i), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/not a google doc or sheet link/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("pdf mode: requires a file", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /pdf upload/i }));
    fireEvent.click(screen.getByRole("button", { name: /import class pdf/i }));
    expect(await screen.findByText(/choose a pdf/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("imports a separate dated class from the teacher's actual filename", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /pdf upload/i }));
    const file = new File(["%PDF-1.4"], "26-4-14_class_note.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/teacher name/i), { target: { value: "Teacher Chen" } });
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [file] } });
    expect((screen.getByLabelText(/class date/i) as HTMLInputElement).value).toBe("2026-04-14");
    fireEvent.click(screen.getByRole("button", { name: /import class pdf/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pdf_upload", externalRef: file.name, label: "Teacher Chen · 2026-04-14", language: "zh" }),
    ));
    expect(uploadSourcePdf).toHaveBeenCalledWith("s1", expect.any(File));
  });

  it("requires the teacher and an explicit date for filenames without a class date", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /pdf upload/i }));
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /import class pdf/i }));
    expect(await screen.findByText(/teacher's name first/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/teacher name/i), { target: { value: "Teacher Chen" } });
    fireEvent.click(screen.getByRole("button", { name: /import class pdf/i }));
    expect(await screen.findByText(/date of this class/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("lets the learner correct a suggested date before importing", async () => {
    render(<SourceForm onAdded={vi.fn()} pdfTeacher={{ label: "Teacher Chen", language: "zh" }} />);
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [new File(["%PDF"], "26-4-14_class_note.pdf")] } });
    fireEvent.change(screen.getByLabelText(/class date/i), { target: { value: "2026-04-15" } });
    fireEvent.click(screen.getByRole("button", { name: /import class pdf/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(expect.objectContaining({ label: "Teacher Chen · 2026-04-15" })));
  });

  it("reuses the teacher for the next PDF without replacing the earlier source", async () => {
    const onAdded = vi.fn();
    addSource.mockResolvedValueOnce({ id: "class1", type: "pdf_upload" }).mockResolvedValueOnce({ id: "class2", type: "pdf_upload" });
    render(<SourceForm onAdded={onAdded} pdfTeacher={{ label: "Teacher Chen", language: "zh" }} />);
    for (const day of ["14", "21"]) {
      fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [new File(["%PDF"], `26-4-${day}_class_note.pdf`)] } });
      fireEvent.click(screen.getByRole("button", { name: /import class pdf/i }));
      await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(day === "14" ? 1 : 2));
    }
    expect(addSource.mock.calls.map(([input]) => input.label)).toEqual(["Teacher Chen · 2026-04-14", "Teacher Chen · 2026-04-21"]);
    expect(uploadSourcePdf.mock.calls.map(([id]) => id)).toEqual(["class1", "class2"]);
  });

  it("canva mode: requires both link and file, stores link as externalRef", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /canva/i }));
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringMatching(/canva design link/i));

    fireEvent.change(screen.getByPlaceholderText(/canva\.com\/design/i), { target: { value: canvaUrl } });
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pdf_upload", externalRef: canvaUrl }),
    ));
    expect(uploadSourcePdf).toHaveBeenCalledWith("s1", expect.any(File));
  });

  it("canva mode: rejects non-canva links", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /canva/i }));
    fireEvent.change(screen.getByPlaceholderText(/canva\.com\/design/i), { target: { value: sheetUrl } });
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/not a canva design link/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });
});
