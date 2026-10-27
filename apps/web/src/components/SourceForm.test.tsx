import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { strToU8, zipSync } from "fflate";

afterEach(cleanup);

const addSource = vi.fn();
const uploadSourcePdf = vi.fn();
vi.mock("@/lib/supabase", () => ({
  api: { addSource: (...a: unknown[]) => addSource(...a), uploadSourcePdf: (...a: unknown[]) => uploadSourcePdf(...a) },
  supabase: { functions: { invoke: vi.fn() } },
}));

const { connectGoogleDrive, driveToken, pickGoogleFile } = vi.hoisted(() => ({
  connectGoogleDrive: vi.fn(), driveToken: vi.fn(), pickGoogleFile: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ connectGoogleDrive }));
vi.mock("@/lib/googlePicker", () => ({ driveToken, pickGoogleFile, clearDrivePickFlag: vi.fn(), pickerConfigured: () => true, PICKER_NOT_READY: "not ready", googleFileId: (ref: string) => /\/d\/([^/?#]+)/.exec(ref)?.[1] }));

import { SourceForm } from "./SourceForm";

const sheetUrl = "https://docs.google.com/spreadsheets/d/1NvH/edit";
const canvaUrl = "https://www.canva.com/design/DAF123abc/view";
const pdfFile = () => new File(["%PDF-1.4"], "lesson.pdf", { type: "application/pdf" });

beforeEach(() => {
  addSource.mockReset();
  uploadSourcePdf.mockReset();
  connectGoogleDrive.mockReset().mockResolvedValue(undefined);
  driveToken.mockReset();
  pickGoogleFile.mockReset();
  addSource.mockResolvedValue({ id: "s1", type: "pdf_upload" });
});

describe("SourceForm", () => {
  it("prepares a PowerPoint over 10 MB before creating and uploading the class", async () => {
    const onAdded = vi.fn();
    const file = new File([zipSync({
      "ppt/presentation.xml": strToU8('<p:presentation xmlns:p="urn:p" xmlns:r="urn:r"><p:sldId r:id="slide"/></p:presentation>'),
      "ppt/_rels/presentation.xml.rels": strToU8('<Relationships><Relationship Id="slide" Target="slides/slide1.xml"/></Relationships>'),
      "ppt/slides/slide1.xml": strToU8('<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>谢谢 thank you</a:t></a:r></a:p></p:sld>'),
      "ppt/media/video.mp4": new Uint8Array(11 * 1024 * 1024),
    }, { level: 0 })], "26-10-23.pptx");
    render(<SourceForm onAdded={onAdded} pdfTeacher={{ label: "Teacher Chen", language: "zh" }} />);
    fireEvent.change(screen.getByLabelText(/pdf or powerpoint files/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /import class file/i }));
    expect(screen.getByRole("status").textContent).toContain("Preparing");
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(addSource).toHaveBeenCalledWith(expect.objectContaining({ externalRef: "26-10-23.pptx", label: "Teacher Chen · 2026-10-23" }));
    const uploaded = uploadSourcePdf.mock.calls[0]![1] as Blob;
    expect(uploaded.type).toBe("text/plain");
    expect(uploaded.size).toBeLessThan(100);
  });

  it("validates every selected document before creating any classes", async () => {
    render(<SourceForm onAdded={vi.fn()} pdfTeacher={{ label: "Teacher Chen", language: "zh" }} />);
    fireEvent.change(screen.getByLabelText(/pdf or powerpoint files/i), { target: { files: [
      new File(["%PDF"], "26-10-22.pdf"), new File(["broken"], "26-10-23.pptx"),
    ] } });
    fireEvent.click(screen.getByRole("button", { name: /import 2 class files/i }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringMatching(/could not read/i));
    expect(addSource).not.toHaveBeenCalled();
    expect(uploadSourcePdf).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /import 2 class files/i }).hasAttribute("disabled")).toBe(false);
  });

  it("google mode: adds the sheet chosen in Google's picker", async () => {
    driveToken.mockReturnValue("tok");
    pickGoogleFile.mockResolvedValue({ url: sheetUrl, name: "Lesson words", type: "google_sheet" });
    const onAdded = vi.fn();
    render(<SourceForm onAdded={onAdded} />);
    fireEvent.click(screen.getByRole("button", { name: /choose from google drive/i }));
    expect(await screen.findByText(/Lesson words/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "google_sheet", externalRef: sheetUrl, label: "Lesson words" }),
    ));
    expect(pickGoogleFile).toHaveBeenCalledWith("tok");
    expect(onAdded).toHaveBeenCalled();
  });

  it("google mode: asks Google for Drive access first when there's no token", async () => {
    driveToken.mockReturnValue(null);
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /choose from google drive/i }));
    await waitFor(() => expect(connectGoogleDrive).toHaveBeenCalledTimes(1));
    expect(pickGoogleFile).not.toHaveBeenCalled();
  });

  it("google mode: re-picking a file that's already a source reconnects it instead of duplicating", async () => {
    driveToken.mockReturnValue("tok");
    pickGoogleFile.mockResolvedValue({ url: sheetUrl, name: "Lesson words", type: "google_sheet" });
    const existing = { id: "old", type: "google_sheet", externalRef: "https://docs.google.com/spreadsheets/d/1NvH/edit#gid=0" } as never;
    const onReconnected = vi.fn();
    render(<SourceForm onAdded={vi.fn()} existing={[existing]} onReconnected={onReconnected} />);
    fireEvent.click(screen.getByRole("button", { name: /choose from google drive/i }));
    await waitFor(() => expect(onReconnected).toHaveBeenCalledWith(existing));
    expect(addSource).not.toHaveBeenCalled();
  });

  it("google mode: requires a chosen file", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/choose a google doc or sheet first/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("pdf mode: requires a file", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /powerpoint upload/i }));
    fireEvent.click(screen.getByRole("button", { name: /import class file/i }));
    expect(await screen.findByText(/choose a pdf/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("imports a separate dated class from the teacher's actual filename", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /powerpoint upload/i }));
    const file = new File(["%PDF-1.4"], "26-4-14_class_note.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/teacher name/i), { target: { value: "Teacher Chen" } });
    fireEvent.change(screen.getByLabelText(/pdf or powerpoint file/i), { target: { files: [file] } });
    expect((screen.getByLabelText(/class date/i) as HTMLInputElement).value).toBe("2026-04-14");
    fireEvent.click(screen.getByRole("button", { name: /import class file/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pdf_upload", externalRef: file.name, label: "Teacher Chen · 2026-04-14", language: "zh" }),
    ));
    expect(uploadSourcePdf).toHaveBeenCalledWith("s1", expect.any(File));
  });

  it("requires the teacher and an explicit date for filenames without a class date", async () => {
    render(<SourceForm onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /powerpoint upload/i }));
    fireEvent.change(screen.getByLabelText(/pdf or powerpoint file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /import class file/i }));
    expect(await screen.findByText(/teacher's name first/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/teacher name/i), { target: { value: "Teacher Chen" } });
    fireEvent.click(screen.getByRole("button", { name: /import class file/i }));
    expect(await screen.findByText(/date of its class/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("lets the learner correct a suggested date before importing", async () => {
    render(<SourceForm onAdded={vi.fn()} pdfTeacher={{ label: "Teacher Chen", language: "zh" }} />);
    fireEvent.change(screen.getByLabelText(/pdf or powerpoint file/i), { target: { files: [new File(["%PDF"], "26-4-14_class_note.pdf")] } });
    fireEvent.change(screen.getByLabelText(/class date/i), { target: { value: "2026-04-15" } });
    fireEvent.click(screen.getByRole("button", { name: /import class file/i }));
    await waitFor(() => expect(addSource).toHaveBeenCalledWith(expect.objectContaining({ label: "Teacher Chen · 2026-04-15" })));
  });

  it("reuses the teacher for the next PDF without replacing the earlier source", async () => {
    const onAdded = vi.fn();
    addSource.mockResolvedValueOnce({ id: "class1", type: "pdf_upload" }).mockResolvedValueOnce({ id: "class2", type: "pdf_upload" });
    render(<SourceForm onAdded={onAdded} pdfTeacher={{ label: "Teacher Chen", language: "zh" }} />);
    for (const day of ["14", "21"]) {
      fireEvent.change(screen.getByLabelText(/pdf or powerpoint file/i), { target: { files: [new File(["%PDF"], `26-4-${day}_class_note.pdf`)] } });
      fireEvent.click(screen.getByRole("button", { name: /import class file/i }));
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
    fireEvent.change(screen.getByLabelText(/pdf or powerpoint file/i), { target: { files: [pdfFile()] } });
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
    fireEvent.change(screen.getByLabelText(/pdf or powerpoint file/i), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(await screen.findByText(/not a canva design link/i)).toBeTruthy();
    expect(addSource).not.toHaveBeenCalled();
  });
});
