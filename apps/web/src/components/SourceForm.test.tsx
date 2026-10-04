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
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/choose a pdf/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("pdf mode: adds the source then uploads the file", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /pdf upload/i }));
    fireEvent.change(screen.getByLabelText(/pdf file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pdf_upload", externalRef: "lesson.pdf" }),
    ));
    expect(uploadSourcePdf).toHaveBeenCalledWith("s1", expect.any(File));
  });

  it("canva mode: requires both link and file, stores link as externalRef", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /canva/i }));
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/canva design link/i)).toBeTruthy();

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
